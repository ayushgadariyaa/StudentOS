import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useQuery } from '../lib/hooks'
import { DAYS, fmtTime } from '../lib/dates'
import { btnQuiet } from '../lib/ui'
import ClassForm from '../components/ClassForm'
import ExtraClasses from '../components/ExtraClasses'
import Problem from '../components/Problem'
import SpecialDays from '../components/SpecialDays'
import TimetableShare from '../components/TimetableShare'

const place = (r) => [r.room, r.building, r.professor].filter(Boolean).join(', ')

export default function Timetable() {
  const subjects = useQuery(() => supabase.from('subjects').select('id, name, code, color').eq('archived', false).order('name'))
  const entries = useQuery(() => supabase.from('timetable_entries').select('*, subjects(name, color)').order('start_time'))
  const [error, setError] = useState(null)

  const subjectList = subjects.data ?? []
  const all = entries.data ?? []
  const weekly = all.filter((r) => !r.on_date) // repeats every week
  const extras = all.filter((r) => r.on_date) // one-off extra classes

  async function remove(id) {
    const { error } = await supabase.from('timetable_entries').delete().eq('id', id)
    setError(error)
    if (!error) entries.reload()
  }

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
          <ClassForm subjects={subjectList} onAdded={entries.reload} />
        </details>
      )}

      <details className="border-b border-rule py-3">
        <summary className="cursor-pointer font-bold text-pen">Holidays, extra classes and special days</summary>
        <div className="mt-4 grid gap-8">
          <SpecialDays />
          <ExtraClasses subjects={subjectList} weekly={weekly} extras={extras} onChanged={entries.reload} />
        </div>
      </details>

      <details className="border-b border-rule py-3">
        <summary className="cursor-pointer font-bold text-pen">Share or import a timetable</summary>
        <TimetableShare
          subjects={subjectList}
          entries={weekly}
          onImported={() => {
            subjects.reload()
            entries.reload()
          }}
        />
      </details>

      <Problem error={error ?? entries.error ?? subjects.error} />

      {DAYS.map((day, i) => {
        const dayRows = weekly.filter((r) => r.day_of_week === i + 1)
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
