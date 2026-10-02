import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { toMinutes, addMinutes } from '../lib/dates'
import { normBatch, isValidBatch, BATCH_HELP } from '../lib/batch'
import { field, btn, btnQuiet } from '../lib/ui'
import DayChips from './DayChips'
import Field from './Field'
import Problem from './Problem'

let nextId = 1
const newSlot = (patch = {}) => ({ id: nextId++, days: [], start: '09:00', end: '10:00', room: '', ...patch })
const minutesLong = (slot) => Math.max(toMinutes(slot.end) - toMinutes(slot.start), 0) || 60

// Adds weekly classes for ONE subject. A subject can have several "times", each with its own days, start and end
// (for example Maths: Mon and Thu 9 to 10, plus Wed 11 to 12). Everything is saved in one go.
export default function ClassForm({ subjects, onAdded }) {
  const [subjectId, setSubjectId] = useState('')
  const [professor, setProfessor] = useState('')
  const [building, setBuilding] = useState('')
  const [batch, setBatch] = useState('') // for labs: the one batch that attends. Empty = everyone.
  const [slots, setSlots] = useState([newSlot()])
  const [error, setError] = useState(null)

  const change = (id, patch) => setSlots(slots.map((s) => (s.id === id ? { ...s, ...patch } : s)))

  // Changing the start time moves the end time too, so a class keeps its length.
  const setStart = (slot, start) => change(slot.id, { start, end: start ? addMinutes(start, minutesLong(slot)) : slot.end })

  // A new time starts where the last one ended, so only its days need picking.
  function addTime() {
    const last = slots[slots.length - 1]
    setSlots([...slots, newSlot({ start: last.end, end: addMinutes(last.end, minutesLong(last)) })])
  }

  async function save(e) {
    e.preventDefault()
    for (const [i, s] of slots.entries()) {
      const where = slots.length > 1 ? `Time ${i + 1}: ` : ''
      if (s.days.length === 0) return setError({ message: `${where}pick at least one day.` })
      if (s.end <= s.start) return setError({ message: `${where}the end time has to be after the start time.` })
    }
    const tag = normBatch(batch)
    if (tag && !isValidBatch(tag)) return setError({ message: BATCH_HELP })
    // One row for every day of every time, all sent in a single request.
    const rows = slots.flatMap((s) =>
      s.days.map((day) => ({
        subject_id: subjectId,
        day_of_week: day,
        start_time: s.start,
        end_time: s.end,
        room: s.room.trim() || null,
        building: building.trim() || null,
        professor: professor.trim() || null,
        batch: tag || null,
      })),
    )
    const { error } = await supabase.from('timetable_entries').insert(rows)
    setError(error)
    if (error) return

    // Ready for the next subject: keep the last time's days and move its time on.
    const last = slots[slots.length - 1]
    setSubjectId('')
    setProfessor('')
    setBuilding('')
    setBatch('') // cleared on purpose, so the next lecture is not tagged by accident
    setSlots([newSlot({ days: last.days, start: last.end, end: addMinutes(last.end, minutesLong(last)) })])
    onAdded(rows.length)
  }

  return (
    <form onSubmit={save} className="mt-4 grid gap-5">
      <Field label="Subject" htmlFor="subject">
        <select id="subject" required className={field} value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          <option value="" disabled>Choose a subject</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </Field>

      {slots.map((slot, i) => (
        <div key={slot.id} className="grid gap-3 border-l-4 border-rule pl-3 sm:grid-cols-3">
          <div className="flex items-center justify-between sm:col-span-3">
            <p className="font-bold">{slots.length > 1 ? `Time ${i + 1}` : 'Days and time'}</p>
            {slots.length > 1 && (
              <button type="button" className={btnQuiet} onClick={() => setSlots(slots.filter((s) => s.id !== slot.id))}>
                Remove this time
              </button>
            )}
          </div>
          <div className="sm:col-span-3">
            <DayChips value={slot.days} onChange={(days) => change(slot.id, { days })} />
          </div>
          <Field label="Starts" htmlFor={`start-${slot.id}`}>
            <input id={`start-${slot.id}`} type="time" required className={field} value={slot.start} onChange={(e) => setStart(slot, e.target.value)} />
          </Field>
          <Field label="Ends" htmlFor={`end-${slot.id}`}>
            <input id={`end-${slot.id}`} type="time" required className={field} value={slot.end} onChange={(e) => change(slot.id, { end: e.target.value })} />
          </Field>
          <Field label="Room (optional)" htmlFor={`room-${slot.id}`}>
            <input id={`room-${slot.id}`} className={field} value={slot.room} onChange={(e) => change(slot.id, { room: e.target.value })} />
          </Field>
        </div>
      ))}

      <div>
        <button type="button" className="text-sm font-bold text-pen underline" onClick={addTime}>
          + Add another time for this subject
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Professor (optional)" htmlFor="professor">
          <input id="professor" className={field} value={professor} onChange={(e) => setProfessor(e.target.value)} />
        </Field>
        <Field label="Building (optional)" htmlFor="building">
          <input id="building" className={field} value={building} onChange={(e) => setBuilding(e.target.value)} />
        </Field>
        <Field
          label="Lab batch (optional)"
          htmlFor="batch"
          hint="For a lab that only one batch attends, for example B1. Leave empty for lectures and anything everyone attends."
          className="sm:col-span-2 sm:max-w-xs"
        >
          <input id="batch" maxLength={20} className={field} value={batch} onChange={(e) => setBatch(e.target.value)} placeholder="B1" />
        </Field>
      </div>

      <Problem error={error} />
      <div>
        <button className={btn}>Add class</button>
      </div>
    </form>
  )
}
