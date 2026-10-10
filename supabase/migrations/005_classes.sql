-- =====================================================================
-- STUDENT OS — migration 005: classes (groups) run by a CR
-- Run once in the Supabase SQL Editor, after 001 to 004. Safe to run again.
-- Run this BEFORE you push the matching app update.
--
-- How it works
--  * A class has admins (the CR, a deputy CR) and members. People join with a code.
--  * An admin saves something on their own screens (a class, a holiday, a task, an exam) and ticks
--    "send to my class". That row gets publish_class_id = the class.
--  * sync_my_classes() runs for every member. It copies the admins' published rows into the member's OWN
--    tables (source_id points back to the original), removes copies that were deleted, and marks cancelled
--    classes. So Today, Timetable and Tasks keep working as before, and attendance stays private.
-- =====================================================================

-- ---------- The class and its people ----------
create table if not exists classes (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 80),
  join_code  text not null unique,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists class_members (
  class_id  uuid not null references classes(id) on delete cascade,
  user_id   uuid not null references profiles(id) on delete cascade,
  role      text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (class_id, user_id)
);
create index if not exists class_members_user_idx on class_members (user_id);

-- Notices from the admins (a message everyone in the class can read)
create table if not exists class_notices (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references classes(id) on delete cascade,
  author_id  uuid not null default auth.uid() references profiles(id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 120),
  body       text check (char_length(body) <= 2000),
  created_at timestamptz not null default now()
);
create index if not exists class_notices_class_idx on class_notices (class_id, created_at desc);

-- A class that an admin cancelled on one date (entry_id = the admin's timetable class)
create table if not exists class_cancellations (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references classes(id) on delete cascade,
  entry_id   uuid not null,
  class_date date not null,
  created_by uuid not null default auth.uid() references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (entry_id, class_date)
);

-- ---------- Columns that connect personal rows to a class ----------
--   publish_class_id : an admin sent this row to that class
--   source_id        : this row is a COPY of the admin's row with that id
--   source_class_id  : ... and it came from that class
alter table timetable_entries
  add column if not exists publish_class_id uuid references classes(id) on delete set null,
  add column if not exists source_id uuid,
  add column if not exists source_class_id uuid references classes(id) on delete set null;
alter table calendar_days
  add column if not exists publish_class_id uuid references classes(id) on delete set null,
  add column if not exists source_id uuid,
  add column if not exists source_class_id uuid references classes(id) on delete set null;
alter table tasks
  add column if not exists publish_class_id uuid references classes(id) on delete set null,
  add column if not exists source_id uuid,
  add column if not exists source_class_id uuid references classes(id) on delete set null;
alter table exams
  add column if not exists publish_class_id uuid references classes(id) on delete set null,
  add column if not exists source_id uuid,
  add column if not exists source_class_id uuid references classes(id) on delete set null;
-- a cancelled class marked on a student's attendance by their class
alter table attendance_records add column if not exists source_id uuid;

-- A student has at most one copy of each original row
create unique index if not exists timetable_entries_source_uq on timetable_entries (user_id, source_id) where source_id is not null;
create unique index if not exists tasks_source_uq on tasks (user_id, source_id) where source_id is not null;
create unique index if not exists exams_source_uq on exams (user_id, source_id) where source_id is not null;

-- ---------- Small helpers (used by the rules below) ----------
create or replace function is_class_member(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from class_members where class_id = cid and user_id = auth.uid())
$$;

create or replace function is_class_admin(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from class_members where class_id = cid and user_id = auth.uid() and role = 'admin')
$$;

create or replace function is_admin_of(cid uuid, uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from class_members where class_id = cid and user_id = uid and role = 'admin')
$$;

-- Eight letters and digits taken from random data, for example 3F9A1C0B
create or replace function new_join_code() returns text
language plpgsql volatile security definer set search_path = public as $$
declare code text;
begin
  loop
    code := upper(substr(md5(gen_random_uuid()::text), 1, 8));
    exit when not exists (select 1 from classes where join_code = code);
  end loop;
  return code;
end $$;

-- ---------- Row Level Security ----------
-- classes: no direct access at all. Everything goes through the functions below.
alter table classes enable row level security;

-- class_members: you can see your own memberships. Changes go through the functions below.
alter table class_members enable row level security;
drop policy if exists "see my own membership" on class_members;
create policy "see my own membership" on class_members
  for select using (user_id = (select auth.uid()));

alter table class_notices enable row level security;
drop policy if exists "members read notices" on class_notices;
drop policy if exists "admins post notices" on class_notices;
drop policy if exists "admins delete notices" on class_notices;
create policy "members read notices" on class_notices for select using (is_class_member(class_id));
create policy "admins post notices" on class_notices
  for insert with check (is_class_admin(class_id) and author_id = (select auth.uid()));
create policy "admins delete notices" on class_notices for delete using (is_class_admin(class_id));

alter table class_cancellations enable row level security;
drop policy if exists "admins manage cancellations" on class_cancellations;
create policy "admins manage cancellations" on class_cancellations
  for all using (is_class_admin(class_id))
  with check (is_class_admin(class_id) and created_by = (select auth.uid()));

-- ---------- Creating, joining and leaving ----------
create or replace function create_class(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  if char_length(trim(coalesce(p_name, ''))) = 0 then raise exception 'Give the class a name.'; end if;
  if (select count(*) from classes where created_by = auth.uid()) >= 5 then
    raise exception 'You can create up to 5 classes.';
  end if;
  insert into classes (name, join_code, created_by)
  values (left(trim(p_name), 80), new_join_code(), auth.uid())
  returning id into cid;
  insert into class_members (class_id, user_id, role) values (cid, auth.uid(), 'admin');
  return cid;
end $$;

create or replace function join_class(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  select id into cid from classes where join_code = upper(trim(coalesce(p_code, '')));
  if cid is null then raise exception 'No class found for that code. Check it and try again.'; end if;
  if (select count(*) from class_members where class_id = cid) >= 500 then
    raise exception 'This class is full.';
  end if;
  insert into class_members (class_id, user_id) values (cid, auth.uid()) on conflict do nothing;
  return cid;
end $$;

create or replace function leave_class(p_class uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); n_people int; n_admins int; i_am_admin boolean;
begin
  select count(*), count(*) filter (where role = 'admin'), coalesce(bool_or(user_id = me and role = 'admin'), false)
    into n_people, n_admins, i_am_admin
    from class_members where class_id = p_class;
  if not exists (select 1 from class_members where class_id = p_class and user_id = me) then return; end if;
  if i_am_admin and n_admins = 1 and n_people > 1 then
    raise exception 'You are the only admin. Make someone else an admin before you leave.';
  end if;

  delete from class_members where class_id = p_class and user_id = me;
  -- take the class's items off this person's screens, and stop publishing to it
  delete from timetable_entries where user_id = me and source_class_id = p_class;
  delete from calendar_days where user_id = me and source_class_id = p_class;
  delete from tasks where user_id = me and source_class_id = p_class;
  delete from exams where user_id = me and source_class_id = p_class;
  update timetable_entries set publish_class_id = null where user_id = me and publish_class_id = p_class;
  update calendar_days set publish_class_id = null where user_id = me and publish_class_id = p_class;
  update tasks set publish_class_id = null where user_id = me and publish_class_id = p_class;
  update exams set publish_class_id = null where user_id = me and publish_class_id = p_class;
  -- the last person out switches the light off
  if n_people = 1 then delete from classes where id = p_class; end if;
end $$;

-- ---------- Looking after the class (admins) ----------
create or replace function set_member_role(p_class uuid, p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
declare creator uuid;
begin
  if not is_class_admin(p_class) then raise exception 'Only admins can change roles.'; end if;
  if p_role not in ('admin', 'member') then raise exception 'Unknown role.'; end if;
  select created_by into creator from classes where id = p_class;
  if p_role = 'member' then
    if creator is distinct from auth.uid() then raise exception 'Only the person who created the class can remove admin rights.'; end if;
    if p_user = auth.uid() then raise exception 'You created this class, so you stay an admin.'; end if;
  end if;
  update class_members set role = p_role where class_id = p_class and user_id = p_user;
end $$;

create or replace function remove_member(p_class uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare target_role text; creator uuid;
begin
  if not is_class_admin(p_class) then raise exception 'Only admins can remove people.'; end if;
  if p_user = auth.uid() then raise exception 'Use Leave class to leave yourself.'; end if;
  select role into target_role from class_members where class_id = p_class and user_id = p_user;
  select created_by into creator from classes where id = p_class;
  if target_role = 'admin' and creator is distinct from auth.uid() then
    raise exception 'Only the person who created the class can remove another admin.';
  end if;
  delete from class_members where class_id = p_class and user_id = p_user;
  -- their copies of the class's items are cleaned up the next time their app syncs
end $$;

create or replace function new_class_code(p_class uuid) returns text
language plpgsql security definer set search_path = public as $$
declare code text;
begin
  if not is_class_admin(p_class) then raise exception 'Only admins can change the code.'; end if;
  code := new_join_code();
  update classes set join_code = code where id = p_class;
  return code;
end $$;

-- ---------- What the app shows ----------
-- The classes I am in. Only admins get the join code.
create or replace function my_classes()
returns table (id uuid, name text, role text, member_count bigint, join_code text, admins text[], is_creator boolean)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, m.role,
         (select count(*) from class_members x where x.class_id = c.id),
         case when m.role = 'admin' then c.join_code end,
         coalesce((select array_agg(coalesce(nullif(trim(p.full_name), ''), 'Unnamed') order by p.full_name)
                   from class_members x join profiles p on p.id = x.user_id
                   where x.class_id = c.id and x.role = 'admin'), '{}'::text[]),
         c.created_by = auth.uid()
  from class_members m join classes c on c.id = m.class_id
  where m.user_id = auth.uid()
  order by c.created_at
$$;

-- Who is in the class. Admins only.
create or replace function class_roster(p_class uuid)
returns table (user_id uuid, full_name text, roll_number text, batch text, role text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_class_admin(p_class) then raise exception 'Only admins can see the member list.'; end if;
  return query
    select m.user_id, p.full_name, p.roll_number, p.batch, m.role
    from class_members m join profiles p on p.id = m.user_id
    where m.class_id = p_class
    order by (m.role = 'admin') desc, p.full_name;
end $$;

-- ---------- The sync: admins' published rows -> this student's own rows ----------
-- Safe to run as often as you like. Returns true when something on this student's screens changed.
create or replace function sync_my_classes() returns boolean
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  my_batch text;
  cls uuid;
  n int;
  changed int := 0;
begin
  if me is null then return false; end if;
  select upper(batch) into my_batch from profiles where id = me;

  for cls in select class_id from class_members where user_id = me loop

    -- 1. Subjects: a subject for every subject name the admins use (only for classes of my batch).
    insert into subjects (user_id, name, code, color)
    select distinct on (lower(trim(s.name))) me, s.name, s.code, s.color
    from subjects s
    where not exists (select 1 from subjects m where m.user_id = me and lower(trim(m.name)) = lower(trim(s.name)))
      and s.id in (
        select subject_id from timetable_entries
         where publish_class_id = cls and user_id <> me and is_admin_of(cls, user_id)
           and (batch is null or my_batch is null or upper(batch) = my_batch)
        union select subject_id from tasks
         where publish_class_id = cls and user_id <> me and is_admin_of(cls, user_id) and subject_id is not null
        union select subject_id from exams
         where publish_class_id = cls and user_id <> me and is_admin_of(cls, user_id))
    order by lower(trim(s.name)), s.created_at;
    get diagnostics n = row_count; changed := changed + n;

    -- 2. Weekly and extra classes
    insert into timetable_entries (user_id, subject_id, day_of_week, start_time, end_time, room, building,
                                   professor, on_date, batch, source_id, source_class_id)
    select me, ms.id, e.day_of_week, e.start_time, e.end_time, e.room, e.building, e.professor, e.on_date,
           e.batch, e.id, cls
    from timetable_entries e
    join subjects s on s.id = e.subject_id
    join lateral (select id from subjects
                   where user_id = me and lower(trim(name)) = lower(trim(s.name))
                   order by created_at limit 1) ms on true
    where e.publish_class_id = cls and e.user_id <> me and is_admin_of(cls, e.user_id)
      and (e.batch is null or my_batch is null or upper(e.batch) = my_batch)
    on conflict (user_id, source_id) where source_id is not null do update
      set subject_id = excluded.subject_id, day_of_week = excluded.day_of_week,
          start_time = excluded.start_time, end_time = excluded.end_time, room = excluded.room,
          building = excluded.building, professor = excluded.professor, on_date = excluded.on_date,
          batch = excluded.batch
      where (timetable_entries.subject_id, timetable_entries.day_of_week, timetable_entries.start_time,
             timetable_entries.end_time, timetable_entries.room, timetable_entries.building,
             timetable_entries.professor, timetable_entries.on_date, timetable_entries.batch)
        is distinct from
            (excluded.subject_id, excluded.day_of_week, excluded.start_time, excluded.end_time, excluded.room,
             excluded.building, excluded.professor, excluded.on_date, excluded.batch);
    get diagnostics n = row_count; changed := changed + n;

    delete from timetable_entries t
    where t.user_id = me and t.source_class_id = cls
      and not exists (select 1 from timetable_entries e
                       where e.id = t.source_id and e.publish_class_id = cls and is_admin_of(cls, e.user_id)
                         and (e.batch is null or my_batch is null or upper(e.batch) = my_batch));
    get diagnostics n = row_count; changed := changed + n;

    -- 3. Holidays and days that follow another weekday (if two admins set the same date, the newest wins)
    insert into calendar_days (user_id, day, kind, follows_day, note, source_id, source_class_id)
    select distinct on (d.day) me, d.day, d.kind, d.follows_day, d.note, d.id, cls
    from calendar_days d
    where d.publish_class_id = cls and d.user_id <> me and is_admin_of(cls, d.user_id)
    order by d.day, d.created_at desc
    on conflict (user_id, day) do update
      set kind = excluded.kind, follows_day = excluded.follows_day, note = excluded.note,
          source_id = excluded.source_id, source_class_id = excluded.source_class_id
      where (calendar_days.kind, calendar_days.follows_day, calendar_days.note, calendar_days.source_id)
        is distinct from (excluded.kind, excluded.follows_day, excluded.note, excluded.source_id);
    get diagnostics n = row_count; changed := changed + n;

    delete from calendar_days t
    where t.user_id = me and t.source_class_id = cls
      and not exists (select 1 from calendar_days d
                       where d.id = t.source_id and d.publish_class_id = cls and is_admin_of(cls, d.user_id));
    get diagnostics n = row_count; changed := changed + n;

    -- 4. Tasks (submissions). My own progress (done or not) is never touched.
    insert into tasks (user_id, subject_id, kind, title, description, deadline, priority, source_id, source_class_id)
    select me, ms.id, t.kind, t.title, t.description, t.deadline, t.priority, t.id, cls
    from tasks t
    left join subjects s on s.id = t.subject_id
    left join lateral (select id from subjects
                        where user_id = me and s.id is not null and lower(trim(name)) = lower(trim(s.name))
                        order by created_at limit 1) ms on true
    where t.publish_class_id = cls and t.user_id <> me and is_admin_of(cls, t.user_id)
    on conflict (user_id, source_id) where source_id is not null do update
      set subject_id = excluded.subject_id, kind = excluded.kind, title = excluded.title,
          description = excluded.description, deadline = excluded.deadline, priority = excluded.priority
      where (tasks.subject_id, tasks.kind, tasks.title, tasks.description, tasks.deadline, tasks.priority)
        is distinct from
            (excluded.subject_id, excluded.kind, excluded.title, excluded.description, excluded.deadline, excluded.priority);
    get diagnostics n = row_count; changed := changed + n;

    delete from tasks t
    where t.user_id = me and t.source_class_id = cls
      and not exists (select 1 from tasks o
                       where o.id = t.source_id and o.publish_class_id = cls and is_admin_of(cls, o.user_id));
    get diagnostics n = row_count; changed := changed + n;

    -- 5. Exams. My own preparation progress is never touched.
    insert into exams (user_id, subject_id, title, exam_at, location, source_id, source_class_id)
    select me, ms.id, x.title, x.exam_at, x.location, x.id, cls
    from exams x
    join subjects s on s.id = x.subject_id
    join lateral (select id from subjects
                   where user_id = me and lower(trim(name)) = lower(trim(s.name))
                   order by created_at limit 1) ms on true
    where x.publish_class_id = cls and x.user_id <> me and is_admin_of(cls, x.user_id)
    on conflict (user_id, source_id) where source_id is not null do update
      set subject_id = excluded.subject_id, title = excluded.title, exam_at = excluded.exam_at,
          location = excluded.location
      where (exams.subject_id, exams.title, exams.exam_at, exams.location)
        is distinct from (excluded.subject_id, excluded.title, excluded.exam_at, excluded.location);
    get diagnostics n = row_count; changed := changed + n;

    delete from exams t
    where t.user_id = me and t.source_class_id = cls
      and not exists (select 1 from exams o
                       where o.id = t.source_id and o.publish_class_id = cls and is_admin_of(cls, o.user_id));
    get diagnostics n = row_count; changed := changed + n;

    -- 6. Cancelled classes: mark my copy of the class as Cancelled on that date.
    --    A mark I made AFTER the cancellation was posted is left alone.
    insert into attendance_records (user_id, subject_id, timetable_entry_id, class_date, status, source_id, created_at)
    select me, te.subject_id, te.id, x.class_date, 'cancelled', x.id, x.created_at
    from class_cancellations x
    join timetable_entries te on te.user_id = me and te.source_id = x.entry_id and te.source_class_id = cls
    where x.class_id = cls
    on conflict (timetable_entry_id, class_date) do update
      set status = 'cancelled', source_id = excluded.source_id
      where attendance_records.source_id is distinct from excluded.source_id
        and attendance_records.created_at <= excluded.created_at;
    get diagnostics n = row_count; changed := changed + n;
  end loop;

  -- A cancellation that was taken back: remove the Cancelled mark it made
  delete from attendance_records a
  where a.user_id = me and a.source_id is not null and a.status = 'cancelled'
    and not exists (select 1 from class_cancellations x where x.id = a.source_id);
  get diagnostics n = row_count; changed := changed + n;

  -- Copies that came from classes I am no longer in (I left, or was removed)
  delete from timetable_entries where user_id = me and source_class_id is not null
    and source_class_id not in (select class_id from class_members where user_id = me);
  get diagnostics n = row_count; changed := changed + n;
  delete from calendar_days where user_id = me and source_class_id is not null
    and source_class_id not in (select class_id from class_members where user_id = me);
  get diagnostics n = row_count; changed := changed + n;
  delete from tasks where user_id = me and source_class_id is not null
    and source_class_id not in (select class_id from class_members where user_id = me);
  get diagnostics n = row_count; changed := changed + n;
  delete from exams where user_id = me and source_class_id is not null
    and source_class_id not in (select class_id from class_members where user_id = me);
  get diagnostics n = row_count; changed := changed + n;

  return changed > 0;
end $$;

-- ---------- Who may call what ----------
-- The sign-in helpers are for signed-in people only. is_admin_of and new_join_code are internal.
do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('is_class_member', 'is_class_admin', 'is_admin_of', 'new_join_code', 'create_class',
                        'join_class', 'leave_class', 'set_member_role', 'remove_member', 'new_class_code',
                        'my_classes', 'class_roster', 'sync_my_classes')
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- Make the API notice the new tables, columns and functions straight away.
notify pgrst, 'reload schema';
