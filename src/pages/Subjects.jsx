import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useQuery } from '../lib/hooks'
import { PALETTE } from '../lib/colors'
import { field, btn, btnQuiet } from '../lib/ui'
import Field from '../components/Field'
import Problem from '../components/Problem'

export default function Subjects() {
  const subjects = useQuery(() => supabase.from('subjects').select('*').eq('archived', false).order('name'))
  const [form, setForm] = useState({ name: '', code: '', color: '' })
  const [error, setError] = useState(null)
  const nameInput = useRef(null)
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const list = subjects.data ?? []
  const suggested = PALETTE[list.length % PALETTE.length] // each new subject gets the next colour

  async function add(e) {
    e.preventDefault()
    const { error } = await supabase.from('subjects').insert({
      name: form.name.trim(),
      code: form.code.trim() || null,
      color: form.color || suggested,
    })
    setError(error)
    if (error) return
    setForm({ name: '', code: '', color: '' })
    await subjects.reload()
    nameInput.current?.focus() // ready for the next subject, so a whole semester is quick to enter
  }

  async function remove(s) {
    if (!confirm(`Remove ${s.name}? Its timetable slots, attendance and tasks for it will be deleted too.`)) return
    const { error } = await supabase.from('subjects').delete().eq('id', s.id)
    setError(error)
    if (!error) subjects.reload()
  }

  return (
    <>
      <h1 className="text-3xl font-bold">Subjects</h1>
      <p className="mt-1 text-ink/70">Your timetable, attendance, tasks and exams all connect to these.</p>

      <form onSubmit={add} className="mt-6 grid gap-4 border-y border-rule py-4 sm:grid-cols-2">
        <Field label="Subject name" htmlFor="name" className="sm:col-span-2">
          <input id="name" ref={nameInput} required className={field} value={form.name} onChange={set('name')} placeholder="Data Structures" />
        </Field>
        <Field label="Course code (optional)" htmlFor="code">
          <input id="code" className={field} value={form.code} onChange={set('code')} />
        </Field>
        <Field label="Colour" htmlFor="color">
          <input id="color" type="color" className="h-10 w-full cursor-pointer rounded-md border border-rule bg-white p-1" value={form.color || suggested} onChange={set('color')} />
        </Field>
        <div className="sm:col-span-2">
          <button className={btn}>Add subject</button>
        </div>
      </form>

      <Problem error={error ?? subjects.error} />

      <ul className="mt-2 divide-y divide-rule">
        {list.map((s) => (
          <li key={s.id} className="flex items-center gap-3 py-3">
            <span className="h-8 w-1.5 rounded-full" style={{ background: s.color }} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{s.name}</p>
              {s.code && <p className="text-sm text-ink/70">{s.code}</p>}
            </div>
            <button className={btnQuiet} onClick={() => remove(s)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}
