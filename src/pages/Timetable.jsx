import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useQuery } from '../lib/hooks'
import { DAYS, fmtTime } from '../lib/dates'
import { field, btn, btnQuiet, label } from '../lib/ui'
import Problem from '../components/Problem'

const EMPTY = { subject_id: '', day_of_week: '1', start_time: '09:00', end_time: '10:00', room: '', building: '', professor: '' }
const place = (r) => [r.room, r.building, r.professor].filter(Boolean).join(', ')

export default function Timetable() {
  const subjects = useQuery(() => supabase.from('subjects').select('id, name').eq('archived', false).order('name'))
  const entries = useQuery(() => supabase.from('timetable_entries').select('*, subjects(name, color)').order('start_time'))
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState(null)
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  async function add(e) {
    e.preventDefault()
    if (form.end_time <= form.start_time) return setError({ message: 'The end time has to be after the start time.' })
    const { error } = await supabase.from('timetable_entries').insert({
      subject_id: form.subject_id,
      day_of_week: Number(form.day_of_week),
      start_time: form.start_time,
      end_time: form.end_time,
      room: form.room.trim() || null,
      building: form.building.trim() || null,
      professor: form.professor.trim() || null,
    })
    setError(error)
    if (!error) {
      setForm({ ...EMPTY, day_of_week: form.day_of_week }) // keep the day, so a whole day is quick to enter
      entries.reload()
    }
  }

  async function remove(id) {
    const { error } = await supabase.from('timetable_entries').delete().eq('id', id)
    setError(error)
    if (!error) entries.reload()
  }

  const subjectList = subjects.data ?? []
  const rows = entries.data ?? []
  return (
    <>
      <h1 className="text-3xl font-bold">Timetable</h1>
      <p className="mt-1 text-ink/70">Your weekly classes. They repeat every week.</p>

      {!subjects.loading && subjectList.length === 0 ? (
        <p className="mt-6 border-y border-rule py-4">
          Add your subjects first, then come back to build your timetable.{' '}
          <Link className="font-bold text-pen underline" to="/subjects">Go to Subjects</Link>
        </p>
      ) : (
        <details open className="mt-6 border-y border-rule py-3">
          <summary className="cursor-pointer font-bold text-pen">Add a class</summary>
          <form onSubmit={add} className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={label} htmlFor="subject">Subject</label>
              <select id="subject" required className={field} value={form.subject_id} onChange={set('subject_id')}>
                <option value="" disabled>Choose a subject</option>
                {subjectList.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="day">Day</label>
              <select id="day" className={field} value={form.day_of_week} onChange={set('day_of_week')}>
                {DAYS.map((d, i) => (
                  <option key={d} value={i + 1}>{d}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label} htmlFor="start">Starts</label>
                <input id="start" type="time" required className={field} value={form.start_time} onChange={set('start_time')} />
              </div>
              <div>
                <label className={label} htmlFor="end">Ends</label>
                <input id="end" type="time" required className={field} value={form.end_time} onChange={set('end_time')} />
              </div>
            </div>
            <div>
              <label className={label} htmlFor="room">Room (optional)</label>
              <input id="room" className={field} value={form.room} onChange={set('room')} />
            </div>
            <div>
              <label className={label} htmlFor="building">Building (optional)</label>
              <input id="building" className={field} value={form.building} onChange={set('building')} />
            </div>
            <div className="sm:col-span-2">
              <label className={label} htmlFor="professor">Professor (optional)</label>
              <input id="professor" className={field} value={form.professor} onChange={set('professor')} />
            </div>
            <div className="sm:col-span-2">
              <button className={btn}>Add class</button>
            </div>
          </form>
        </details>
      )}

      <Problem error={error ?? entries.error ?? subjects.error} />

      {DAYS.map((day, i) => {
        const dayRows = rows.filter((r) => r.day_of_week === i + 1)
        if (dayRows.length === 0) return null
        return (
          <section key={day} className="mt-8">
            <h2 className="text-xl font-bold">{day}</h2>
            <ul className="mt-2 divide-y divide-rule border-y border-rule">
              {dayRows.map((r) => (
                <li key={r.id} className="flex items-center gap-3 border-l-4 py-3 pl-3" style={{ borderLeftColor: r.subjects.color }}>
                  <div className="min-w-0 flex-1">
                    <p className="font-slab text-lg font-semibold tabular-nums">
                      {fmtTime(r.start_time)} to {fmtTime(r.end_time)}
                    </p>
                    <p className="truncate">
                      <span className="font-bold">{r.subjects.name}</span>
                      {place(r) && <span className="text-ink/70">, {place(r)}</span>}
                    </p>
                  </div>
                  <button className={btnQuiet} onClick={() => remove(r.id)}>Remove</button>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </>
  )
}
