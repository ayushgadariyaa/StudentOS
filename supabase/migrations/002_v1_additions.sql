-- =====================================================================
-- STUDENT OS — migration 002: profile details, task types, timetable sharing
-- Run once in the Supabase SQL Editor, after 001_initial_schema.sql.
-- Safe to run again: each statement checks whether it was already applied.
-- =====================================================================

-- ---------- Profile: who the student is ----------
alter table profiles
  add column if not exists roll_number text,
  add column if not exists department  text,
  add column if not exists semester    text,   -- free text, e.g. "Semester 5"
  add column if not exists division    text;   -- section or batch, e.g. "A"

-- ---------- Tasks: what kind of coursework is it? ----------
-- Plain text, not an enum, so new kinds can be added in the app without another migration.
-- The app uses: assignment, lab_manual, tutorial, practical_file, project, presentation, other.
alter table tasks
  add column if not exists kind text not null default 'other';

-- ---------- Timetable sharing ----------
-- A student shares a SNAPSHOT of their timetable under a short code.
-- Classmates can fetch a snapshot only by knowing its exact code.
create table if not exists timetable_shares (
  code       text primary key,
  owner_id   uuid not null default auth.uid() references profiles(id) on delete cascade,
  payload    jsonb not null check (octet_length(payload::text) < 100000),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);

alter table timetable_shares enable row level security;

drop policy if exists "owners manage their own shares" on timetable_shares;
create policy "owners manage their own shares" on timetable_shares
  for all using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- Nobody can list other people's shares. This function returns ONE snapshot,
-- and only for an exact code that has not expired.
create or replace function get_shared_timetable(share_code text) returns jsonb
language sql stable security definer set search_path = public as $$
  select payload from timetable_shares
  where code = upper(trim(share_code)) and expires_at > now()
$$;

revoke all on function get_shared_timetable(text) from public, anon;
grant execute on function get_shared_timetable(text) to authenticated;

-- Make the API notice the new columns and function straight away.
notify pgrst, 'reload schema';
