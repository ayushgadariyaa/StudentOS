-- =====================================================================
-- STUDENT OS — migration 003: extra classes, holidays and special days
-- Run once in the Supabase SQL Editor, after 001 and 002. Safe to run again.
-- Run this BEFORE you push the matching app update.
-- =====================================================================

-- ---------- Extra classes ----------
-- A timetable entry with an on_date applies to that ONE date only (an extra class).
-- Normal weekly classes keep on_date = null.
alter table timetable_entries add column if not exists on_date date;

create index if not exists timetable_entries_on_date_idx
  on timetable_entries (user_id, on_date) where on_date is not null;

-- ---------- Special days ----------
--   holiday : no weekly classes that day
--   follows : the day uses another weekday's timetable (for example a Saturday that follows Monday)
create table if not exists calendar_days (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references profiles(id) on delete cascade,
  day         date not null,
  kind        text not null check (kind in ('holiday', 'follows')),
  follows_day smallint check (follows_day between 1 and 7),  -- 1 = Monday ... 7 = Sunday
  note        text,
  created_at  timestamptz not null default now(),
  unique (user_id, day),
  check ((kind = 'follows') = (follows_day is not null))
);

alter table calendar_days enable row level security;

drop policy if exists "own rows" on calendar_days;
create policy "own rows" on calendar_days
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Make the API notice the new column and table straight away.
notify pgrst, 'reload schema';
