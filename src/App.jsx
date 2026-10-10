import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { supabase, configured } from './lib/supabase'
import { useUpdateAvailable, refreshApp } from './lib/useUpdateCheck'
import Login from './pages/Login'
import Today from './pages/Today'
import Timetable from './pages/Timetable'
import Attendance from './pages/Attendance'
import Tasks from './pages/Tasks'
import Exams from './pages/Exams'
import Subjects from './pages/Subjects'
import Profile from './pages/Profile'
import Classes from './pages/Classes'
import { useClassSync } from './lib/classes'

// One list drives every menu. `tab: true` puts an item in the phone's bottom bar, the others become
// small links at the top of the phone screen. On a computer everything is in the side menu.
// To add a page: create it in src/pages, add a <Route> below, and add it to this list.
const NAV = [
  { to: '/', label: 'Today', end: true, tab: true },
  { to: '/timetable', label: 'Timetable', tab: true },
  { to: '/attendance', label: 'Attendance', tab: true },
  { to: '/tasks', label: 'Tasks', tab: true },
  { to: '/exams', label: 'Exams', tab: true },
  { to: '/class', label: 'Class' },
  { to: '/subjects', label: 'Subjects' },
  { to: '/profile', label: 'Profile' },
]

const sideLink = ({ isActive }) =>
  `block rounded-md px-3 py-2 text-[15px] ${isActive ? 'bg-pen/10 font-bold text-pen' : 'text-ink/70 hover:bg-ink/5 hover:text-ink'}`
const tabLink = ({ isActive }) => `flex-1 py-3 text-center text-sm ${isActive ? 'font-bold text-pen' : 'text-ink/70'}`
const topLink = ({ isActive }) => `px-2 py-1 text-sm ${isActive ? 'font-bold text-pen' : 'text-ink/70'}`

const Screen = ({ children }) => <div className="grid min-h-screen place-items-center p-6 text-center">{children}</div>

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = still checking who is signed in
  const stale = useUpdateAvailable() // true when a newer version of the app has been deployed

  useEffect(() => {
    if (!configured) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user?.id
  useEffect(() => {
    // Safety net: the database trigger normally creates the profile row at sign-up.
    if (userId) {
      supabase.from('profiles').upsert({ id: userId }, { onConflict: 'id', ignoreDuplicates: true }).then(() => {})
    }
  }, [userId])

  // Copies what your class has sent onto your own screens. The number goes up when something changed,
  // and a new key makes the pages load again.
  const syncVersion = useClassSync(userId)

  if (!configured) {
    return (
      <Screen>
        <p className="max-w-sm">
          Add your Supabase URL and key to a <code>.env</code> file (copy <code>.env.example</code>), then restart{' '}
          <code>npm run dev</code>.
        </p>
      </Screen>
    )
  }
  if (session === undefined) return <Screen>Loading…</Screen>
  if (!session) return <Login />

  return (
    <BrowserRouter>
      <div className="mx-auto max-w-4xl md:flex md:gap-10 md:px-6">
        <aside className="hidden w-44 shrink-0 md:sticky md:top-0 md:flex md:h-screen md:flex-col md:py-6">
          <span className="font-slab text-2xl font-bold">Student OS</span>
          <nav className="mt-6 flex flex-col gap-1">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={sideLink}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <button className="mt-auto rounded-md px-3 py-2 text-left text-sm text-ink/70 hover:bg-ink/5" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="flex items-center justify-between border-b border-rule px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] md:hidden">
            <span className="font-slab text-xl font-bold">Student OS</span>
            <nav className="flex">
              {NAV.filter((n) => !n.tab).map((n) => (
                <NavLink key={n.to} to={n.to} className={topLink}>
                  {n.label}
                </NavLink>
              ))}
            </nav>
          </header>
          {stale && (
            <button onClick={refreshApp} className="block w-full bg-pen px-4 py-2 text-center text-sm font-bold text-white">
              A new version is ready. Tap to update.
            </button>
          )}
          <main className="px-4 pb-28 pt-6 md:px-0 md:pb-12">
            <Routes key={syncVersion}>
              <Route path="/" element={<Today />} />
              <Route path="/timetable" element={<Timetable />} />
              <Route path="/attendance" element={<Attendance user={session.user} />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/exams" element={<Exams />} />
              <Route path="/class" element={<Classes userId={session.user.id} />} />
              <Route path="/subjects" element={<Subjects />} />
              <Route path="/profile" element={<Profile user={session.user} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-rule bg-paper pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.filter((n) => n.tab).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={tabLink}>
            {n.label}
          </NavLink>
        ))}
      </nav>
    </BrowserRouter>
  )
}
