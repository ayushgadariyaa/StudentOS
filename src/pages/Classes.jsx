import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useQuery } from '../lib/hooks'
import { useMyClasses, syncMyClasses } from '../lib/classes'
import { plural } from '../lib/text'
import { field, btn, btnQuiet } from '../lib/ui'
import ClassAdmin from '../components/ClassAdmin'
import ClassNotices from '../components/ClassNotices'
import Field from '../components/Field'
import Problem from '../components/Problem'

// The Class tab: join your class with a code, or create one if you are the CR.
// What a class sends (classes, holidays, tasks, exams, cancellations) arrives on your normal screens by itself.
export default function Classes({ userId }) {
  const { classes, error: loadError, reload } = useMyClasses()
  const profile = useQuery(() => supabase.from('profiles').select('batch').maybeSingle())
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState(null)

  // Runs a database action, then brings the class's items onto this student's screens.
  async function run(action) {
    setError(null)
    const { error } = await action
    if (error) {
      setError(error)
      return false
    }
    await syncMyClasses()
    reload()
    return true
  }
  async function join(e) {
    e.preventDefault()
    if (await run(supabase.rpc('join_class', { p_code: code }))) setCode('')
  }
  async function create(e) {
    e.preventDefault()
    if (await run(supabase.rpc('create_class', { p_name: name }))) setName('')
  }
  function leave(c) {
    if (confirm(`Leave ${c.name}? Its classes, tasks and exams are taken off your screens.`)) {
      run(supabase.rpc('leave_class', { p_class: c.id }))
    }
  }

  const notReady = loadError?.code === 'PGRST202' // the database function is missing: migration 005 has not been run
  return (
    <>
      <h1 className="text-3xl font-bold">Class</h1>
      <p className="mt-1 text-ink/70">
        Join your class to get its timetable, holidays, cancelled classes, submissions and exams by themselves. Your attendance stays private.
      </p>

      {notReady && (
        <p className="mt-4 border-l-4 border-red-600 bg-red-50 px-3 py-2 text-sm text-red-900">
          This needs one more database step (migration 005). Run it in the Supabase SQL Editor, then reload.
        </p>
      )}
      <Problem error={notReady ? null : error ?? loadError} />

      {classes.map((c) => (
        <section key={c.id} className="mt-8 border-t border-rule pt-4">
          <h2 className="text-2xl font-bold">{c.name}</h2>
          <p className="mt-1 text-sm text-ink/70">
            {c.role === 'admin' ? 'You are an admin.' : 'You are a member.'} {plural(Number(c.member_count), 'person', 'people')}.
            Admins: {c.admins.join(', ')}.
          </p>
          {!profile.loading && !profile.data?.batch && (
            <p className="mt-2 text-sm">
              You have not set a lab batch, so you get every batch's labs.{' '}
              <Link className="font-bold text-pen underline" to="/profile">Set it in Profile</Link>
            </p>
          )}

          <ClassNotices classId={c.id} canPost={c.role === 'admin'} />
          {c.role === 'admin' && <ClassAdmin cls={c} userId={userId} onChanged={reload} />}

          <div className="mt-4">
            <button className={`${btnQuiet} -ml-2.5`} onClick={() => leave(c)}>
              Leave class
            </button>
          </div>
        </section>
      ))}

      <div className="mt-8 grid gap-8 border-t border-rule pt-6 sm:grid-cols-2">
        <form onSubmit={join} className="grid content-start gap-3">
          <h2 className="text-xl font-bold">Join a class</h2>
          <Field label="Class code" htmlFor="class-code" hint="Ask your CR. The admins of a class can see your name, roll number and lab batch.">
            <input id="class-code" required maxLength={12} autoComplete="off" className={`${field} uppercase`} value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
          <div>
            <button className={btn}>Join</button>
          </div>
        </form>

        <details className="content-start">
          <summary className="cursor-pointer text-xl font-bold">Are you a CR? Create a class</summary>
          <form onSubmit={create} className="mt-3 grid gap-3">
            <Field label="Class name" htmlFor="class-name" hint="For example CE 3rd sem, Div A. You can add a deputy CR as a second admin later.">
              <input id="class-name" required maxLength={80} className={field} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <div>
              <button className={btn}>Create class</button>
            </div>
          </form>
        </details>
      </div>
    </>
  )
}
