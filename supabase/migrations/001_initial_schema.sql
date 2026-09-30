-- =====================================================================
-- STUDENT OS — Version 1 schema (Supabase / PostgreSQL)
-- Run once: Supabase Dashboard → SQL Editor → New query → paste → Run.
-- Scope: student features only. Roles/RBAC are deliberately left out for
-- now; adding a `role` column to `profiles` later is a one-line migration.
-- Every row belongs to one user, enforced by Row Level Security (RLS).
-- =====================================================================

-- ---------- Enums ----------
create type priority_level    as enum ('low', 'medium', 'high');
create type task_status       as enum ('todo', 'in_progress', 'done');
create type assignment_status as enum ('pending', 'in_progress', 'submitted');
create type attendance_status as enum ('present', 'absent', 'cancelled');
create type reminder_category as enum ('submission', 'fee', 'document', 'event', 'general');

-- ---------- Profiles (one row per signed-up user) ----------
create table profiles (
  id                     uuid primary key references auth.users(id) on delete cascade,
  full_name              text,
  college                text,
  attendance_target      int not null default 75 check (attendance_target between 1 and 100),
  attendance_warn_margin int not null default 5  check (attendance_warn_margin between 0 and 30),
  created_at             timestamptz not null default now()
);

create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- Subjects: the hub everything else connects to ----------
create table subjects (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references profiles(id) on delete cascade,
  name              text not null,
  code              text,
  color             text not null default '#6366f1',
  attendance_target int check (attendance_target between 1 and 100),       -- null = use profile default
  initial_attended  int not null default 0 check (initial_attended >= 0),  -- for students joining mid-semester
  initial_conducted int not null default 0,
  archived          boolean not null default false,
  created_at        timestamptz not null default now(),
  check (initial_conducted >= initial_attended)
);

-- ---------- Timetable (weekly recurring classes) ----------
create table timetable_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references profiles(id) on delete cascade,
  subject_id  uuid not null references subjects(id) on delete cascade,
  professor   text,
  room        text,
  building    text,
  day_of_week smallint not null check (day_of_week between 1 and 7),  -- 1 = Monday ... 7 = Sunday
  start_time  time not null,
  end_time    time not null,
  check (end_time > start_time)
);

-- ---------- Tasks ----------
create table tasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references profiles(id) on delete cascade,
  subject_id   uuid references subjects(id) on delete set null,
  title        text not null,
  description  text,
  deadline     timestamptz,
  priority     priority_level not null default 'medium',
  status       task_status    not null default 'todo',
  completed_at timestamptz,
  created_at   timestamptz not null default now()
);

-- ---------- Reminders ----------
create table reminders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references profiles(id) on delete cascade,
  title       text not null,
  notes       text,
  category    reminder_category not null default 'general',
  remind_at   timestamptz not null,
  is_done     boolean not null default false,
  notified_at timestamptz,  -- set by the future push/email job so nothing is sent twice
  created_at  timestamptz not null default now()
);

-- ---------- Assignments ----------
create table assignments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references profiles(id) on delete cascade,
  subject_id   uuid not null references subjects(id) on delete cascade,
  title        text not null,
  description  text,
  deadline     timestamptz not null,
  priority     priority_level    not null default 'medium',
  status       assignment_status not null default 'pending',
  submitted_at timestamptz,
  created_at   timestamptz not null default now()
);

-- ---------- Exams ----------
create table exams (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references profiles(id) on delete cascade,
  subject_id  uuid not null references subjects(id) on delete cascade,
  title       text,                        -- e.g. "Mid-sem"
  exam_at     timestamptz not null,        -- the countdown runs off this
  location    text,
  preparation smallint not null default 0 check (preparation between 0 and 100),  -- % prepared
  created_at  timestamptz not null default now()
);

-- ---------- Attendance: one row per class, so totals are always derived ----------
create table attendance_records (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references profiles(id) on delete cascade,
  subject_id         uuid not null references subjects(id) on delete cascade,
  timetable_entry_id uuid references timetable_entries(id) on delete set null,  -- null = extra class
  class_date         date not null,
  status             attendance_status not null,
  created_at         timestamptz not null default now(),
  unique (timetable_entry_id, class_date)  -- one mark per scheduled class per day
);

-- Cancelled classes are ignored in the totals. Calculator maths (in the app):
--   needed in a row = ceil((T*c - 100*a) / (100 - T))    can still skip = floor(100*a / T - c)
create view attendance_summary with (security_invoker = true) as
select *, case when conducted > 0 then round(100.0 * attended / conducted, 1) end as percentage
from (
  select s.id as subject_id, s.user_id, s.name,
         s.initial_attended  + count(r.id) filter (where r.status = 'present')              as attended,
         s.initial_conducted + count(r.id) filter (where r.status in ('present', 'absent')) as conducted
  from subjects s
  left join attendance_records r on r.subject_id = s.id
  where not s.archived
  group by s.id
) t;

-- ---------- Indexes ----------
create index on subjects (user_id) where not archived;
create index on timetable_entries (user_id, day_of_week, start_time);
create index on tasks (user_id, status, deadline);
create index on reminders (user_id, remind_at) where not is_done;
create index on assignments (user_id, status, deadline);
create index on exams (user_id, exam_at);
create index on attendance_records (subject_id, class_date);

-- ---------- Row Level Security: users only ever see their own rows ----------
alter table profiles enable row level security;
create policy "own profile" on profiles
  for all using (id = (select auth.uid())) with check (id = (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['subjects', 'timetable_entries', 'tasks', 'reminders',
                           'assignments', 'exams', 'attendance_records']
  loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy "own rows" on %I for all
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;
