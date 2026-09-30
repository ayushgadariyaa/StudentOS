import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { supabase, configured } from './lib/supabase'
import { btnQuiet } from './lib/ui'
import Login from './pages/Login'
import Today from './pages/Today'
import Timetable from './pages/Timetable'
import Attendance from './pages/Attendance'
import Subjects from './pages/Subjects'

// Phase 3 adds Tasks, Assignments, Exams and Reminders to this list.
const NAV = [
  { to: '/', label: 'Today', end: true },
  { to: '/timetable', label: 'Timetable' },
  { to: '/attendance', label: 'Attendance' },
  { to: '/subjects', label: 'Subjects' },
]

const tab = ({ isActive }) =>
  `px-3 py-3 text-[15px] md:py-2 ${isActive ? 'font-bold text-pen' : 'text-ink/70 hover:text-ink'}`

const Tabs = ({ className }) => (
  <nav className={className}>
    {NAV.map((n) => (
      <NavLink key={n.to} to={n.to} end={n.end} className={tab}>
        {n.label}
      </NavLink>
    ))}
  </nav>
)

const Screen = ({ children }) => <div className="grid min-h-screen place-items-center p-6 text-center">{children}</div>

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = still checking

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
      <header className="sticky top-0 z-10 border-b border-rule bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-2">
          <span className="font-slab text-xl font-bold">Student OS</span>
          <Tabs className="hidden md:flex" />
          <button className={btnQuiet} onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 pb-28 pt-6 md:pb-12">
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/timetable" element={<Timetable />} />
          <Route path="/attendance" element={<Attendance user={session.user} />} />
          <Route path="/subjects" element={<Subjects />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Tabs className="fixed inset-x-0 bottom-0 z-10 flex justify-around border-t border-rule bg-paper pb-[env(safe-area-inset-bottom)] md:hidden" />
    </BrowserRouter>
  )
}
