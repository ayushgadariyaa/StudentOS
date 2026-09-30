# Student OS

Version 1, student side: sign in, subjects, timetable, daily attendance marking and the attendance calculator.
Tasks, assignments, exams and reminders are next.

## Run it

1. Install Node.js 20.19+ (or 22.12+).
2. In this folder, run `npm install`.
3. Copy `.env.example` to `.env` and fill in your Supabase Project URL and the public anon/publishable key
   (Supabase dashboard → Project Settings → API).
4. Run `npm run dev` and open the address it prints (usually http://localhost:5173).

While testing, turn off "Confirm email" for the Email provider in Supabase's Authentication settings,
so sign-up works without waiting for an email link.

Only the public anon/publishable key belongs in this app. Never paste the `service_role` / secret key here.
Row Level Security in the database is what keeps each student's data private.

## Deploy on Vercel

Import the repo, add the same two `VITE_` variables under Environment Variables, and deploy.
`vercel.json` already makes page refreshes work.
