# Student OS

One place for college life: timetable, attendance, tasks, exams and more.
This repository is **Version 1, the student side**. Roles (professor, cultural head, admin) are on hold on
purpose, so every account is a student for now.

**Stack:** React + Vite, Tailwind CSS, Supabase (PostgreSQL + sign-in), Vercel for hosting.

## What works today

- Sign up and sign in, and a profile (name, roll number, college, department, semester, division)
- Subjects, each with a colour
- Timetable: add a class on several days at once, see the week, share it with a code, import a classmate's
- Today: your classes, mark Present / Absent / Cancelled, attendance warnings, deadlines and exams coming up
- Attendance: percentage per subject, classes needed or skippable, starting numbers for mid-semester joiners
- Tasks: assignments, lab manuals, tutorials and more, with due dates, priority and filters
- Exams: countdown and preparation progress

What is done and what is next: [docs/CHECKLIST.md](docs/CHECKLIST.md)

## Run it on your computer

1. Install [Node.js](https://nodejs.org) 20.19 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and fill in your Supabase **Project URL** and **anon/publishable key**
   (Supabase dashboard, Project Settings, API).
4. Run `npm run dev` and open the address it prints (usually http://localhost:5173).

## Set up the database

1. Create a project at [supabase.com](https://supabase.com).
2. Open the SQL Editor and run every file in `supabase/migrations/` **in number order** (001, then 002, ...).
3. While testing, turn off "Confirm email" for the Email provider in Supabase's Authentication settings,
   so sign-up works without waiting for an email link.

Never edit a migration that has already been run. A database change means a new numbered file.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the app with live reload |
| `npm test` | Runs the tests for the attendance maths |
| `npm run build` | Makes the production version in `dist/` |
| `npm run preview` | Serves that production build locally |

## Reading the code

Start with [docs/CODE_TOUR.md](docs/CODE_TOUR.md). It explains how the files fit together and in what order to read them.

## Keys and Git

- `.env` is ignored by Git on purpose. Never commit it.
- Only the public anon/publishable key belongs in this app. Never use the secret `service_role` key here.
- Row Level Security (set up in the migrations) is what keeps each student's data private.

## Deploy on Vercel

Import the repository, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under Environment Variables, and deploy.
`vercel.json` already makes page refreshes work.
