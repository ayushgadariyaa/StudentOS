import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useQuery } from '../lib/hooks'
import { DAYS, datesBetween, fmtDay, localDate } from '../lib/dates'
import { field, btn, btnQuiet } from '../lib/ui'
import Field from './Field'
import Problem from './Problem'

// Special days: a holiday (no weekly classes) or a day that follows another weekday's timetable
// (for example "this Saturday follows Monday"). Stored in calendar_days, one row per date.
export default function SpecialDays() {
  const today = localDate()
  const days = useQuery(() => supabase.from('calendar_days').select('*').gte('day', today).order('day'))
  const [form, setForm] = useState({ kind: 'follows', from: '', to: '', follows: '1', note: '' })
  const [error, setError] = useState(null)
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  async function add(e) {
    e.preventDefault()
    const last = form.kind === 'holiday' && form.to ? form.to : form.from
    const dates = datesBetween(form.from, last)
    if (dates.length === 0) return setError({ message: 'The last day has to be on or after the first day.' })
    if (dates.length > 60) return setError({ message: 'Please add at most 60 days at a time.' })
    const rows = dates.map((day) => ({
      day,
      kind: form.kind,
      follows_day: form.kind === 'follows' ? Number(form.follows) : null,
      note: form.note.trim() || null,
    }))
    // upsert: a date that already has a special day is replaced
    const { error } = await supabase.from('calendar_days').upsert(rows, { onConflict: 'user_id,day' })
    setError(error)
    if (error) return
    setForm({ ...form, from: '', to: '', note: '' })
    days.reload()
  }

  async function remove(id) {
    const { error } = await supabase.from('calendar_days').delete().eq('id', id)
    setError(error)
    if (!error) days.reload()
  }

  return (
    <div>
      <h3 className="text-lg font-bold">Holidays and special days</h3>
      <p className="mt-1 text-sm text-ink/70">
        Mark a holiday, or a day that follows another day's timetable, such as a Saturday that follows Monday.
      </p>
      <form onSubmit={add} className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="What kind of day?" htmlFor="sd-kind">
          <select id="sd-kind" className={field} value={form.kind} onChange={set('kind')}>
            <option value="follows">Follows another day's timetable</option>
            <option value="holiday">Holiday, no classes</option>
          </select>
        </Field>
        {form.kind === 'follows' && (
          <Field label="Which day's timetable?" htmlFor="sd-follows">
            <select id="sd-follows" className={field} value={form.follows} onChange={set('follows')}>
              {DAYS.map((d, i) => (
                <option key={d} value={i + 1}>{d}</option>
              ))}
            </select>
          </Field>
        )}
        <Field label={form.kind === 'holiday' ? 'First day' : 'Date'} htmlFor="sd-from">
          <input id="sd-from" type="date" required className={field} value={form.from} onChange={set('from')} />
        </Field>
        {form.kind === 'holiday' && (
          <Field label="Last day (optional)" htmlFor="sd-to" hint="Leave empty for a single day.">
            <input id="sd-to" type="date" className={field} value={form.to} onChange={set('to')} />
          </Field>
        )}
        <Field label="Note (optional)" htmlFor="sd-note" className="sm:col-span-2">
          <input id="sd-note" className={field} value={form.note} onChange={set('note')} placeholder="Diwali break" />
        </Field>
        <div className="sm:col-span-2">
          <button className={btn}>Save</button>
        </div>
      </form>

      <Problem error={error ?? days.error} />

      <ul className="mt-3 divide-y divide-rule empty:hidden">
        {(days.data ?? []).map((d) => (
          <li key={d.id} className="flex items-center gap-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="font-bold">{fmtDay(d.day)}</p>
              <p className="text-sm text-ink/70">
                {d.kind === 'holiday' ? 'Holiday, no classes' : `Follows ${DAYS[d.follows_day - 1]}'s timetable`}
                {d.note && `, ${d.note}`}
              </p>
            </div>
            <button className={btnQuiet} onClick={() => remove(d.id)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
