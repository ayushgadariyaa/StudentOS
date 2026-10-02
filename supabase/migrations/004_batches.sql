-- =====================================================================
-- STUDENT OS — migration 004: lab batches
-- Run once in the Supabase SQL Editor, after 001, 002 and 003. Safe to run again.
-- Run this BEFORE you push the matching app update.
-- =====================================================================

-- ---------- Which batch is a class for? ----------
-- null = everyone (a lecture). "B1" = only students of batch B1 (a lab).
-- The app stores batch names in capitals without spaces, up to 20 characters.
alter table timetable_entries
  add column if not exists batch text check (batch is null or char_length(batch) between 1 and 20);

-- ---------- Which batch is the student in? ----------
-- Today hides the labs of other batches. null = show every class.
alter table profiles
  add column if not exists batch text check (batch is null or char_length(batch) between 1 and 20);

-- Make the API notice the new columns straight away.
notify pgrst, 'reload schema';
