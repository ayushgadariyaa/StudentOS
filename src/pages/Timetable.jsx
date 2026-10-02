import { useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useQuery } from '../lib/hooks'
import { DAYS, fmtTime, isoWeekday } from '../lib/dates'
import { plural } from '../lib/text'
import { normBatch, isValidBatch, BATCH_HELP } from '../lib/batch'
import { btn, btnOutline, btnQuiet } from '../lib/ui'
import BatchTag from '../components/BatchTag'
import ClassForm from '../components/ClassForm'
import ExtraClasses from '../components/ExtraClasses'
import Problem from '../components/Problem'
import SpecialDays from '../components/SpecialDays'
import TimetableShare from '../components/TimetableShare'

const place = (r) => [r.room, r.building, r.professor].filter(Boolean).join(', ')

// The Timetable tab has four views, chosen by the address: /timetable (the week), ?view=add,
// ?view=special (holidays and extra classes) and ?view=share. The week stays calm and shows only the timetable,
// and because each view has its own address, the phone's Back button works.
export default function Timetable() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const view = params.get('view') ?? 'week'

  const subjects = useQuery(() => supabase.from('subjects').select('id, name, code, color').eq('archived', false).order('name'))
  const entries = useQuery(() => supabase.from('timetable_entries').select('*, subjects(name, color)').order('start_time'))
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(false) // shows the Remove buttons
  const [notice, setNotice] = useState(null)

  const go = (name) => {
    setNotice(null)
    setParams({ view: name })
  }
  // Back goes to the previous screen. If this view was opened directly (no history), go to the week instead.
  const back = () => (location.key === 'default' ? navigate('/timetable', { replace: true }) : navigate(-1))

  const subjectList = subjects.data ?? []
  const all = entries.data ?? []
  const weekly = all.filter((r) => !r.on_date) // repeats every week
  const extras = all.filter((r) => r.on_date) // one-off extra classes

  async function remove(id) {
    const { error } = await supabase.from('timetable_entries').delete().eq('id', id)
    setError(error)
    if (!error) entries.reload()
  }

  // Edit mode: set or change the batch of a class you already added. Empty = for everyone.
  async function setBatchOf(row, value) {
    const batch = normBatch(value) || null
    if (batch === (row.batch ?? null)) return
    if (batch && !isValidBatch(batch)) return setError({ message: BATCH_HELP })
    const { error } = await supabase.from('timetable_entries').update({ batch }).eq('id', row.id)
    setError(error)
    if (!error) entries.reload()
  }

  if (view !== 'week') {
    return (
      <>
        <button className={`${btnQuiet} -ml-2.5`} onClick={back}>
          Back to timetable
        </button>

        {view === 'add' && (
          <>
            <h1 className="mt-2 text-3xl font-bold">Add a class</h1>
            {!subjects.loading && subjectList.length === 0 ? (
              <p className="mt-6 border-y border-rule py-4">
                Add your subjects first, then come back.{' '}
                <Link className="font-bold text-pen underline" to="/subjects">Go to Subjects</Link>
              </p>
            ) : (
              <>
                <ClassForm
                  subjects={subjectList}
                  onAdded={(n) => {
                    setNotice(`Added ${plural(n, 'class', 'classes')}.`)
                    entries.reload()
                  }}
                />
                {notice && <p className="mt-4 font-bold text-pen">{notice} Add another, or go back to see your timetable.</p>}
              </>
            )}
          </>
        )}

        {view === 'special' && (
          <>
            <h1 className="mt-2 text-3xl font-bold">Holidays and extra classes</h1>
            <div className="mt-4 grid gap-8">
              <SpecialDays />
              <ExtraClasses subjects={subjectList} weekly={weekly} extras={extras} onChanged={entries.reload} />
            </div>
          </>
        )}

        {view === 'share' && (
          <>
            <h1 className="mt-2 text-3xl font-bold">Share or import</h1>
            <TimetableShare
              subjects={subjectList}
              entries={weekly}
              onImported={() => {
                subjects.reload()
                entries.reload()
              }}
            />
          </>
        )}
      </>
    )
  }

  const today = isoWeekday()
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Timetable</h1>
          <p className="mt-1 text-ink/70">Your weekly classes. They repeat every week.</p>
        </div>
        {weekly.length > 0 && (
          <button className={btnQuiet} onClick={() => setEditing(!editing)}>
            {editing ? 'Done' : 'Edit'}
          </button>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button className={btn} onClick={() => go('add')}>Add class</button>
        <button className={btnOutline} onClick={() => go('special')}>Holidays and extra classes</button>
        <button className={btnOutline} onClick={() => go('share')}>Share or import</button>
      </div>

      <Problem error={error ?? entries.error ?? subjects.error} />

      {editing && (
        <p className="mt-3 text-sm text-ink/70">
          To make a lab belong to one batch, type the batch (for example B1) in the box next to it. Leave the box empty
          for lectures.
        </p>
      )}

      {!entries.loading && weekly.length === 0 && (
        <p className="mt-6 border-y border-rule py-4">
          No classes yet. Tap Add class to start, or use Share or import to copy a classmate's timetable.
        </p>
      )}

      {DAYS.map((day, i) => {
        const dayRows = weekly.filter((r) => r.day_of_week === i + 1)
        if (dayRows.length === 0) return null
        const isToday = i + 1 === today
        return (
          <section key={day} className="mt-8">
            <h2 className={`text-xl font-bold ${isToday ? 'text-pen' : ''}`}>
              {day}
              {isToday && <span className="ml-2 text-sm font-normal text-ink/70">today</span>}
            </h2>
            <ul className="mt-2 divide-y divide-rule border-y border-rule">
              {dayRows.map((r) => (
                <li key={r.id} className="flex items-center gap-3 border-l-4 py-2.5 pl-3" style={{ borderLeftColor: r.subjects.color }}>
                  <div className="min-w-0 flex-1">
                    <p className="font-slab text-lg font-semibold tabular-nums">
                      {fmtTime(r.start_time)} to {fmtTime(r.end_time)}
                    </p>
                    <p className="truncate">
                      <span className="font-bold">{r.subjects.name}</span>
                      <BatchTag batch={r.batch} />
                      {place(r) && <span className="text-ink/70">, {place(r)}</span>}
                    </p>
                  </div>
                  {editing && (
                    <>
                      <input
                        key={`${r.id}-${r.batch ?? ''}`}
                        aria-label={`Lab batch for ${r.subjects.name}`}
                        className="w-20 rounded-md border border-rule bg-white px-2 py-1 text-sm text-ink outline-none focus:border-pen"
                        defaultValue={r.batch ?? ''}
                        maxLength={20}
                        placeholder="Batch"
                        onBlur={(e) => setBatchOf(r, e.target.value)}
                      />
                      <button className={btnQuiet} onClick={() => remove(r.id)}>
                        Remove
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </>
  )
}
