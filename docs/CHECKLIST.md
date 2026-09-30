# Student OS, V1 checklist

Change `[ ]` to `[x]` when a feature is done. Updated 30 September 2026.

**30 of 74 items built.** Built means the code is in the project. It does not mean tested: every screen still needs trying on a real phone with real data.

## Foundation and setup

- [x] React + Vite + Tailwind CSS project with a phone-first layout
- [x] Supabase database; every table protected by Row Level Security
- [x] Database changes saved as numbered files in supabase/migrations
- [x] README, Code Tour and tests for the attendance maths (npm test)
- [x] Vercel config so page refreshes work
- [ ] Deploy to Vercel and share the link with friends
- [ ] Installable on the home screen (PWA: icon and install prompt)
- [ ] Faster first load (split the code into smaller chunks)

## Accounts and profile

- [x] Sign up and sign in with email and password
- [x] Profile created automatically at sign-up
- [x] Profile page: name, roll number, college, department, semester, division
- [ ] Forgot-password flow
- [ ] Delete my account and data
- [ ] Sign in with Google
- [ ] Roles: professor, cultural head, admin (on hold on purpose)

## Subjects

- [x] Add subjects quickly: name, optional code, colour chosen for you
- [x] Remove a subject
- [ ] Edit a subject (rename, recolour)
- [ ] Archive subjects at the end of a semester
- [ ] Subject workspace for notes and links

## Timetable

- [x] Add weekly classes: subject, day, time, room, building, professor
- [x] Pick several days at once for classes that repeat during the week
- [x] End time fills in by itself; the next class starts where the last one ended
- [x] Week view grouped by day
- [x] Share your timetable with a code; classmates add it in one tap
- [x] Stop sharing; codes expire after 30 days
- [ ] Edit a class
- [ ] Alternate-week classes (for example lab batches)
- [ ] Holidays and days off

## Today screen

- [x] Today's classes with Now and Next
- [x] Mark Present, Absent or Cancelled (tap again to undo)
- [x] Attendance warnings
- [x] Coming up: task deadlines and exams
- [ ] Today's reminders
- [ ] Catch up on earlier days you forgot to mark

## Attendance

- [x] Attended, held and percentage for each subject
- [x] Your own minimum percentage
- [x] Classes needed in a row, or classes you can still skip
- [x] Starting numbers for each subject (moved here from Subjects)
- [ ] History for each subject
- [ ] A different minimum for one subject
- [ ] What if I skip tomorrow? calculator

## Tasks (assignments, lab manuals, tutorials)

- [x] Types: assignment, lab manual, tutorial, practical file, project, presentation, other
- [x] Subject, due date and time, priority, notes
- [x] Tick when done; filter by type; overdue items highlighted
- [ ] Edit a task
- [ ] Attach a photo or PDF
- [ ] Repeating tasks

## Exams

- [x] Exam with subject, title, date, time and room
- [x] Countdown and preparation progress
- [x] Past exams kept separately
- [ ] Edit an exam
- [ ] Topic checklist for each exam

## Reminders and notifications

- [ ] Reminders: title, date, time, category (submission, fee, document, event)
- [ ] Repeating reminders
- [ ] Real notifications on your phone (push or email)

## Before you share V1 with friends

- [ ] Run migration 002 in Supabase
- [ ] Try every screen on a real phone, on Wi-Fi and on mobile data
- [ ] Decide how to handle networks that block supabase.co (route requests through your own domain)
- [ ] Privacy policy and terms page
- [ ] A way for friends to send feedback
- [ ] Basic usage numbers (how many people open it each day)

## Version 2 (from the product overview)

- [ ] Expense tracker: categories, monthly budget, summaries
- [ ] Cultural and college events: create, publish, show details
- [ ] Student registration for events
- [ ] Custom registration forms
- [ ] Cultural head tools to manage registrations
- [ ] Admin overview (needs roles)

## Version 3 (future)

- [ ] AI assistant that knows your timetable, tasks and exams
- [ ] Natural-language reminders
- [ ] AI study planner
- [ ] Notes and syllabus PDF understanding
- [ ] Smart notifications
- [ ] Collaboration and more college services

## Ideas to discuss

- **Class groups.** A shared class space where one timetable change updates everyone. One student sets it up and the whole class joins, which makes it the natural growth loop.
- **WhatsApp share button.** Send the timetable code with a ready-made message.
- **Google sign-in.** One tap instead of a password, and no forgotten passwords.
- **Skip planner.** See what happens to your attendance if you skip tomorrow before you decide.
- **Holidays and days off.** Mark them once so attendance stays honest.
- **Exam planner.** Spread the topics across the days left before an exam.
- **Semester rollover.** Archive old subjects and start fresh while keeping the history.
- **Weekly summary.** One message each Sunday: this week's classes, deadlines and exams.
