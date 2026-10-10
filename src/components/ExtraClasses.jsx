import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { DAYS, isoWeekday, localDate, fmtDay, fmtTime } from '../lib/dates'
import { normBatch, isValidBatch, BATCH_HELP } from '../lib/batch'
import { field, btn, btnQuiet } from '../lib/ui'
import BatchTag from './BatchTag'
import Field from './Field'
import Problem from './Problem'
import { useSendToClass } from './SendToClass'
import { withClass } from '../lib/classes'

const EMPTY_CUSTOM = { subject_id: '', start: '09:00', end: '10:00', room: '', batch: '' }

// Extra classes: one-off classes on a single date (often a Saturday). They are saved as timetable entries
// with an on_date, so Today and Attendance treat them like any other class.
// `weekly` = your normal weekly classes (to pick from), `extras` = extra classes already added.
export default function ExtraClasses({ subjects, weekly, extras, onChanged }) {
  const [date, setDate] = useState('')
  const [picked, setPicked] = useState(new Set()) // ids of the weekly classes that are ticked
  const [custom, setCustom] = useState(EMPTY_CUSTOM)
  const [error, setError] = useState(null)
  const send = useSendToClass(true) // class admins: also send these extra classes to the class

  const weekdayOf = (d) => isoWeekday(new Date(`${d}T00:00`))
  const same = (a, b) =>
    a.on_date === b.on_date &&
    a.subject_id === b.subject_id &&
    a.start_time.slice(0, 5) === b.start_time.slice(0, 5) &&
    normBatch(a.batch) === normBatch(b.batch)

  function tick(id) {
    const next = new Set(picked)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setPicked(next)
  }

  async function save(rows, afterSaving) {
    const fresh = rows.filter((r) => !extras.some((x) => same(x, r))) // never add the same class twice
    if (fresh.length === 0) return setError({ message: 'Those classes are already on that date.' })
    const { error } = await supabase.from('timetable_entries').insert(fresh.map((r) => withClass(r, send.classId)))
    setError(error)
    if (error) return
    afterSaving()
    onChanged()
  }

  function addPicked() {
    if (!date) return setError({ message: 'Pick the date first.' })
    const rows = weekly
      .filter((w) => picked.has(w.id))
      .map((w) => ({
        subject_id: w.subject_id,
        day_of_week: weekdayOf(date),
        start_time: w.start_time,
        end_time: w.end_time,
        room: w.room,
        building: w.building,
        professor: w.professor,
        batch: w.batch ?? null, // an extra lab stays a lab for the same batch
        on_date: date,
      }))
    if (rows.length === 0) return setError({ message: 'Tick at least one class from your timetable.' })
    save(rows, () => setPicked(new Set()))
  }

  function addCustom(e) {
    e.preventDefault()
    if (!date) return setError({ message: 'Pick the date first.' })
    if (custom.end <= custom.start) return setError({ message: 'The end time has to be after the start time.' })
    const tag = normBatch(custom.batch)
    if (tag && !isValidBatch(tag)) return setError({ message: BATCH_HELP })
    const row = {
      subject_id: custom.subject_id,
      day_of_week: weekdayOf(date),
      start_time: custom.start,
      end_time: custom.end,
      room: custom.room.trim() || null,
      batch: tag || null,
      on_date: date,
    }
    save([row], () => setCustom({ ...custom, subject_id: '', room: '', batch: '' }))
  }

  async function remove(id) {
    const { error } = await supabase.from('timetable_entries').delete().eq('id', id)
    setError(error)
    if (!error) onChanged()
  }

  const today = localDate()
  const upcoming = extras
    .filter((x) => x.on_date >= today)
    .sort((a, b) => a.on_date.localeCompare(b.on_date) || a.start_time.localeCompare(b.start_time))

  return (
    <div>
      <h3 className="text-lg font-bold">Extra classes</h3>
      <p className="mt-1 text-sm text-ink/70">
        One-off classes on a single date, such as a Saturday. Pick the date, then tick classes from your timetable or add
        one at a different time.
      </p>
      <Field label="Date" htmlFor="extra-date" className="mt-3 max-w-xs">
        <input id="extra-date" type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>

      {send.control && <div className="mt-3">{send.control}</div>}

      <p className="mt-4 font-bold">Pick from your timetable</p>
      {weekly.length === 0 ? (
        <p className="text-sm text-ink/70">Your timetable is empty.</p>
      ) : (
        <div className="mt-2 max-h-64 overflow-y-auto border-y border-rule">
          {DAYS.map((day, i) => {
            const rows = weekly.filter((w) => w.day_of_week === i + 1)
            if (rows.length === 0) return null
            return (
              <div key={day} className="py-2">
                <p className="text-sm font-bold text-ink/70">{day}</p>
                {rows.map((w) => (
                  <label key={w.id} className="flex items-center gap-3 py-1.5">
                    <input type="checkbox" className="h-5 w-5 accent-pen" checked={picked.has(w.id)} onChange={() => tick(w.id)} />
                    <span>
                      {w.subjects.name}, {fmtTime(w.start_time)} to {fmtTime(w.end_time)}
                      <BatchTag batch={w.batch} />
                    </span>
                  </label>
                ))}
              </div>
            )
          })}
        </div>
      )}
      <button type="button" className={`${btn} mt-3`} onClick={addPicked}>
        Add ticked classes to this date
      </button>

      <form onSubmit={addCustom} className="mt-6 grid gap-3 sm:grid-cols-3">
        <p className="font-bold sm:col-span-3">Not in your timetable?</p>
        <Field label="Subject" htmlFor="extra-subject" className="sm:col-span-3">
          <select id="extra-subject" required className={field} value={custom.subject_id} onChange={(e) => setCustom({ ...custom, subject_id: e.target.value })}>
            <option value="" disabled>Choose a subject</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Starts" htmlFor="extra-start">
          <input id="extra-start" type="time" required className={field} value={custom.start} onChange={(e) => setCustom({ ...custom, start: e.target.value })} />
        </Field>
        <Field label="Ends" htmlFor="extra-end">
          <input id="extra-end" type="time" required className={field} value={custom.end} onChange={(e) => setCustom({ ...custom, end: e.target.value })} />
        </Field>
        <Field label="Room (optional)" htmlFor="extra-room">
          <input id="extra-room" className={field} value={custom.room} onChange={(e) => setCustom({ ...custom, room: e.target.value })} />
        </Field>
        <Field label="Lab batch (optional)" htmlFor="extra-batch" className="sm:col-span-3 sm:max-w-xs">
          <input id="extra-batch" maxLength={20} className={field} value={custom.batch} onChange={(e) => setCustom({ ...custom, batch: e.target.value })} placeholder="B1" />
        </Field>
        <div className="sm:col-span-3">
          <button className={btn}>Add this class</button>
        </div>
      </form>

      <Problem error={error} />

      <ul className="mt-4 divide-y divide-rule border-y border-rule empty:hidden">
        {upcoming.map((x) => (
          <li key={x.id} className="flex items-center gap-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="font-bold">
                {x.subjects.name}
                <BatchTag batch={x.batch} />
              </p>
              <p className="text-sm text-ink/70">
                {fmtDay(x.on_date)}, {fmtTime(x.start_time)} to {fmtTime(x.end_time)}
              </p>
            </div>
            {x.source_id ? (
              <span className="text-sm text-ink/70">From your class</span>
            ) : (
              <button className={btnQuiet} onClick={() => remove(x.id)}>
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
