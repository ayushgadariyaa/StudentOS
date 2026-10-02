# Code tour

Read this first. It explains how Student OS fits together, so you can study the code one file at a time.

## The big picture

- The app is a **React** single-page app, built with **Vite** and styled with **Tailwind CSS**.
- There is **no server of our own**. The browser talks straight to **Supabase**: a hosted PostgreSQL database plus a sign-in system.
- Privacy is enforced inside the database by **Row Level Security (RLS)**. Rules such as "you can only read and change rows whose `user_id` is yours" live in `supabase/migrations/`. That is why it is fine for the Supabase URL and anon key to be visible in the browser: without a signed-in user they open nothing.

## How the app starts

`index.html` → `src/main.jsx` → `src/App.jsx` → one file in `src/pages/`

1. `main.jsx` puts `<App />` on the page.
2. `App.jsx` asks Supabase who is signed in. Nobody: show the `Login` page. Someone: show the menus and the routes.
3. The address in the browser decides which page is shown (`/tasks` shows `pages/Tasks.jsx`). This is **React Router**.

## Folder map

```
src/
  main.jsx               starts React
  App.jsx                sign-in check, menus, routes
  index.css              Tailwind plus our colours and fonts
  lib/                   plain JavaScript helpers, no screens
    supabase.js            creates the Supabase connection from .env
    hooks.js               useQuery: loads data when a page opens
    attendance.js          the attendance maths (tested by attendance.test.js)
    share.js               timetable sharing: make a code, look it up, import it
    dates.js  text.js      small date and wording helpers
    schedule.js            which classes happen on a date (weekly + special days + extras)
    kinds.js  colors.js    the task types and the subject colour list
    ui.js                  shared Tailwind class names (inputs, buttons)
  components/            small pieces used by several pages
  pages/                 one file per screen
supabase/migrations/     the database, as numbered SQL files
android/  www/           the Android app shell (Capacitor); www/ is only a fallback page
capacitor.config.json    the app name, id, and the website address it opens
.github/workflows/       builds the APK in the cloud
docs/                    this tour and the checklist
```

## The pattern every page follows

1. **Load**: `const tasks = useQuery(() => supabase.from('tasks').select('*'))`
2. **Remember what is typed**: `const [form, setForm] = useState(...)`
3. **Change data**: an async function calls `insert`, `update`, `delete` or `upsert`, checks for an `error`, then calls `tasks.reload()`
4. **Draw**: JSX that shows the data and the form

Read `pages/Subjects.jsx` first. It is the smallest complete example.

## Worked example: marking attendance

`pages/Today.jsx`, function `mark()`:

1. You tap **Present** on a class.
2. `mark()` does an `upsert` into `attendance_records`: one row per class per day. Tapping the same button again deletes the row, which is the undo.
3. The page reloads its data.
4. The database view `attendance_summary` recounts attended and held classes, so every percentage on screen updates.

## The attendance maths

`lib/attendance.js`. With `T` = your minimum %, `a` = classes attended and `c` = classes held:

- Classes to attend in a row: `ceil((T*c - 100*a) / (100 - T))`
- Classes you can still skip: `floor(100*a / T - c)`

Cancelled classes are not counted. Run `npm test` to see examples that prove it.

## Sharing a timetable

`lib/share.js` (the logic) and `components/TimetableShare.jsx` (the screen). Sharing saves a **snapshot** in `timetable_shares` under a random code. A classmate's app fetches it through the database function `get_shared_timetable`, then adds those subjects and classes to **their own** tables. Nothing stays linked. The import code checks every value, because the data came from another person.

## Special days and extra classes

The weekly timetable is a pattern. Real weeks have exceptions, so `lib/schedule.js` combines three things for any date: the weekly classes, a **special day** (a holiday has no weekly classes; a day can also *follow* another weekday's timetable, like a Saturday that follows Monday), and **extra classes** (timetable entries with an `on_date`). `Today.jsx` calls `classesOn(date, entries, special)`. Because attendance is saved per class per date, marking a Monday class on a Saturday just works.

## The database

`001_initial_schema.sql` creates the tables, the `attendance_summary` view and the RLS rules. `002_v1_additions.sql` adds profile fields, task types and sharing. `003_calendar_exceptions.sql` adds extra classes (`on_date` on `timetable_entries`) and special days (`calendar_days`). The `assignments` table from 001 is not used yet: all coursework lives in `tasks`, with a `kind` such as lab manual or tutorial.

## Recipe: add a new page

1. Create `src/pages/Thing.jsx` (copy `Subjects.jsx` and change it).
2. Add a `<Route>` and an entry in `NAV` in `App.jsx`.
3. Need a new table or column? Add a new numbered file in `supabase/migrations/`, run it in the Supabase SQL Editor, and turn on RLS with a policy for the new table.

## Studying this code with an AI helper

- Give it **one file at a time**, plus this tour for context. Ask: "Explain this file line by line for a beginner, then ask me 5 questions about it."
- After it explains something, **change the code and see what breaks**. That is how it sticks.
- When an answer feels shaky, ask a second assistant the same question. Running the code settles arguments.
