import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useQuery } from '../lib/hooks'
import { field, btn, btnQuiet, label } from '../lib/ui'
import Problem from '../components/Problem'

const EMPTY = { name: '', code: '', color: '#2545C8', attended: '', conducted: '' }

export default function Subjects() {
  const subjects = useQuery(() => supabase.from('subjects').select('*').eq('archived', false).order('name'))
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState(null)
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  async function add(e) {
    e.preventDefault()
    const attended = Number(form.attended) || 0
    const conducted = Number(form.conducted) || 0
    if (attended > conducted) return setError({ message: "Classes attended can't be more than classes held." })
    const { error } = await supabase.from('subjects').insert({
      name: form.name.trim(),
      code: form.code.trim() || null,
      color: form.color,
      initial_attended: attended,
      initial_conducted: conducted,
    })
    setError(error)
    if (!error) {
      setForm(EMPTY)
      subjects.reload()
    }
  }

  async function remove(s) {
    if (!confirm(`Remove ${s.name}? Its timetable slots and attendance records will be deleted too.`)) return
    const { error } = await supabase.from('subjects').delete().eq('id', s.id)
    setError(error)
    if (!error) subjects.reload()
  }

  const list = subjects.data ?? []
  return (
    <>
      <h1 className="text-3xl font-bold">Subjects</h1>
      <p className="mt-1 text-ink/70">Your timetable, attendance and (soon) tasks all connect to these.</p>

      <details open className="mt-6 border-y border-rule py-3">
        <summary className="cursor-pointer font-bold text-pen">Add a subject</summary>
        <form onSubmit={add} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={label} htmlFor="name">Subject name</label>
            <input id="name" required className={field} value={form.name} onChange={set('name')} placeholder="Data Structures" />
          </div>
          <div>
            <label className={label} htmlFor="code">Course code (optional)</label>
            <input id="code" className={field} value={form.code} onChange={set('code')} />
          </div>
          <div>
            <label className={label} htmlFor="color">Colour</label>
            <input id="color" type="color" className="h-10 w-full cursor-pointer rounded-md border border-rule bg-white p-1" value={form.color} onChange={set('color')} />
          </div>
          <p className="text-sm text-ink/70 sm:col-span-2">
            Already partway through the semester? Enter your current numbers so your percentage starts out right.
          </p>
          <div>
            <label className={label} htmlFor="attended">Classes attended so far</label>
            <input id="attended" type="number" min="0" className={field} value={form.attended} onChange={set('attended')} placeholder="0" />
          </div>
          <div>
            <label className={label} htmlFor="conducted">Classes held so far</label>
            <input id="conducted" type="number" min="0" className={field} value={form.conducted} onChange={set('conducted')} placeholder="0" />
          </div>
          <div className="sm:col-span-2">
            <button className={btn}>Add subject</button>
          </div>
        </form>
      </details>

      <Problem error={error ?? subjects.error} />

      <ul className="mt-2 divide-y divide-rule">
        {list.map((s) => (
          <li key={s.id} className="flex items-center gap-3 py-3">
            <span className="h-8 w-1.5 rounded-full" style={{ background: s.color }} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{s.name}</p>
              {s.code && <p className="text-sm text-ink/70">{s.code}</p>}
            </div>
            <button className={btnQuiet} onClick={() => remove(s)}>Remove</button>
          </li>
        ))}
      </ul>
    </>
  )
}
