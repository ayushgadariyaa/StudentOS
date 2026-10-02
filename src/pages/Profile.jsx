import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useQuery } from '../lib/hooks'
import { normBatch, isValidBatch, BATCH_HELP } from '../lib/batch'
import { field, btn, btnQuiet } from '../lib/ui'
import Field from '../components/Field'
import Problem from '../components/Problem'

const FIELDS = ['full_name', 'roll_number', 'college', 'department', 'semester', 'division', 'batch']

export default function Profile({ user }) {
  const profile = useQuery(() => supabase.from('profiles').select('*').maybeSingle())
  // Wait until the profile has loaded, so the form starts with the saved values.
  if (profile.loading) return <p className="text-ink/70">Loading…</p>
  return <ProfileForm user={user} initial={profile.data ?? {}} loadError={profile.error} />
}

function ProfileForm({ user, initial, loadError }) {
  const [form, setForm] = useState(Object.fromEntries(FIELDS.map((k) => [k, initial[k] ?? ''])))
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(loadError)
  const set = (key) => (e) => {
    setForm({ ...form, [key]: e.target.value })
    setSaved(false)
  }

  async function save(e) {
    e.preventDefault()
    const values = Object.fromEntries(FIELDS.map((k) => [k, form[k].trim() || null]))
    values.batch = normBatch(form.batch) || null // stored in capitals without spaces, so "b 2" and "B2" match
    if (values.batch && !isValidBatch(values.batch)) return setError({ message: BATCH_HELP })
    // upsert = update the row, or create it if it is somehow missing
    const { error } = await supabase.from('profiles').upsert({ id: user.id, ...values })
    setError(error)
    setSaved(!error)
    if (!error) setForm((f) => ({ ...f, batch: values.batch ?? '' }))
  }

  return (
    <>
      <h1 className="text-3xl font-bold">Profile</h1>
      <p className="mt-1 text-ink/70">Signed in as {user.email}. Only you can see your profile.</p>

      <form onSubmit={save} className="mt-6 grid gap-4 border-y border-rule py-4 sm:grid-cols-2">
        <Field label="Your name" htmlFor="full_name" className="sm:col-span-2">
          <input id="full_name" autoComplete="name" className={field} value={form.full_name} onChange={set('full_name')} />
        </Field>
        <Field label="Roll or enrolment number" htmlFor="roll_number">
          <input id="roll_number" className={field} value={form.roll_number} onChange={set('roll_number')} />
        </Field>
        <Field label="College" htmlFor="college">
          <input id="college" className={field} value={form.college} onChange={set('college')} />
        </Field>
        <Field label="Department or branch" htmlFor="department">
          <input id="department" className={field} value={form.department} onChange={set('department')} placeholder="Computer Engineering" />
        </Field>
        <Field label="Semester or year" htmlFor="semester">
          <input id="semester" className={field} value={form.semester} onChange={set('semester')} placeholder="Semester 5" />
        </Field>
        <Field label="Division" htmlFor="division" hint="When you share your timetable, only your name, department, semester and division go with it.">
          <input id="division" className={field} value={form.division} onChange={set('division')} placeholder="A" />
        </Field>
        <Field label="Lab batch" htmlFor="batch" hint="For example B2. Today hides labs meant for other batches. Leave it empty to see every class.">
          <input id="batch" maxLength={20} className={field} value={form.batch} onChange={set('batch')} placeholder="B1" />
        </Field>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button className={btn}>Save profile</button>
          {saved && <span className="font-bold text-pen">Saved.</span>}
        </div>
      </form>

      <Problem error={error} />

      <div className="mt-6 flex flex-wrap gap-2">
        <Link to="/subjects" className={`${btnQuiet} underline`}>Manage subjects</Link>
        <button className={btnQuiet} onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
    </>
  )
}
