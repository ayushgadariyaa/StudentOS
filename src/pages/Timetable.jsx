import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useQuery } from '../lib/hooks'
import { DAYS, fmtTime, toMinutes, addMinutes } from '../lib/dates'
import { field, btn, btnQuiet } from '../lib/ui'
import DayChips from '../components/DayChips'
import Field from '../components/Field'
import Problem from '../components/Problem'
import TimetableShare from '../components/TimetableShare'

const EMPTY = { subject_id: '', days: [], start: '09:00', end: '10:00', room: '', building: '', professor: '' }
const place = (r) => [r.room, r.building, r.professor].filter(Boolean).join(', ')

export default function Timetable() {
  const subjects = useQuery(() => supabase.from('subjects').select('id, name, code, color').eq('archived', false).order('name'))
  const entries = useQuery(() => supabase.from('timetable_entries').select('*, subjects(name, color)').order('start_time'))
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState(null)
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  // Changing the start time moves the end time too, so a class keeps its length.
  function setStart(e) {
    const start = e.target.value
    const length = Math.max(toMinutes(form.end) - toMinutes(form.start), 0) || 60
    setForm({ ...form, start, end: start ? addMinutes(start, length) : form.end })
  }

  async function add(e) {
    e.preventDefault()
    if (form.days.length === 0) return setError({ message: 'Pick at least one day.' })
    if (form.end <= form.start) return setError({ message: 'The end time has to be after the start time.' })

    // One row per selected day, all sent in a single request.
    const rows = form.days.map((day) => ({
      subject_id: form.subject_id,
      day_of_week: day,
      start_time: form.start,
      end_time: form.end,
      room: form.room.trim() || null,
      building: form.building.trim() || null,
      professor: form.professor.trim() || null,
    }))
    const { error } = await supabase.from('timetable_entries').insert(rows)
    setError(error)
    if (error) return

    // Get ready for the next class: keep the days, move the time on, clear the rest.
    const length = toMinutes(form.end) - toMinutes(form.start)
    setForm({ ...EMPTY, days: form.days, start: form.end, end: addMinutes(form.end, length) })
    entries.reload()
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
            <Field label="Subject" htmlFor="subject" className="sm:col-span-2">
              <select id="subject" required className={field} value={form.subject_id} onChange={set('subject_id')}>
                <option value="" disabled>Choose a subject</option>
                {subjectList.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Days (pick every day this class happens)" className="sm:col-span-2">
              <DayChips value={form.days} onChange={(days) => setForm({ ...form, days })} />
            </Field>
            <Field label="Starts" htmlFor="start">
              <input id="start" type="time" required className={field} value={form.start} onChange={setStart} />
            </Field>
            <Field label="Ends" htmlFor="end">
              <input id="end" type="time" required className={field} value={form.end} onChange={set('end')} />
            </Field>
            <Field label="Room (optional)" htmlFor="room">
              <input id="room" className={field} value={form.room} onChange={set('room')} />
            </Field>
            <Field label="Building (optional)" htmlFor="building">
              <input id="building" className={field} value={form.building} onChange={set('building')} />
            </Field>
            <Field label="Professor (optional)" htmlFor="professor" className="sm:col-span-2">
              <input id="professor" className={field} value={form.professor} onChange={set('professor')} />
            </Field>
            <div className="sm:col-span-2">
              <button className={btn}>Add class</button>
            </div>
          </form>
        </details>
      )}

      <details className="border-b border-rule py-3">
        <summary className="cursor-pointer font-bold text-pen">Share or import a timetable</summary>
        <TimetableShare
          subjects={subjectList}
          entries={rows}
          onImported={() => {
            subjects.reload()
            entries.reload()
          }}
        />
      </details>

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
                  <button className={btnQuiet} onClick={() => remove(r.id)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </>
  )
}
