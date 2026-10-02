import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useQuery } from '../lib/hooks'
import { attendanceStats, advice } from '../lib/attendance'
import { DAYS, localDate, fmtTime, hm } from '../lib/dates'
import { classesOn } from '../lib/schedule'
import { plural } from '../lib/text'
import BatchTag from '../components/BatchTag'
import Percent from '../components/Percent'
import Problem from '../components/Problem'
import ComingUp from '../components/ComingUp'

const MARKS = [
  ['present', 'Present', 'bg-mark-green'],
  ['absent', 'Absent', 'bg-mark-red'],
  ['cancelled', 'Cancelled', 'bg-ink/15'],
]

export default function Today() {
  const today = localDate()
  // The weekly classes, plus any extra classes added for today.
  const entries = useQuery(() =>
    supabase.from('timetable_entries').select('*, subjects(name, color)').or(`on_date.is.null,on_date.eq.${today}`),
  )
  // Is today a holiday, or a day that follows another weekday's timetable?
  const special = useQuery(() => supabase.from('calendar_days').select('*').eq('day', today).maybeSingle())
  const marks = useQuery(() => supabase.from('attendance_records').select('*').eq('class_date', today))
  const summary = useQuery(() => supabase.from('attendance_summary').select('*'))
  const profile = useQuery(() =>
    supabase.from('profiles').select('attendance_target, attendance_warn_margin, batch').maybeSingle(),
  )
  const [error, setError] = useState(null)

  // Labs of other batches are left out. Wait for the profile first, so they do not flash on screen and vanish.
  const myBatch = profile.data?.batch
  const everything = classesOn(today, entries.data ?? [], special.data ?? undefined)
  const list = profile.loading ? [] : classesOn(today, entries.data ?? [], special.data ?? undefined, myBatch)
  const hidden = profile.loading ? 0 : everything.length - list.length
  const markFor = (id) => (marks.data ?? []).find((m) => m.timetable_entry_id === id)
  const now = new Date().toTimeString().slice(0, 5)
  const current = list.find((c) => hm(c.start_time) <= now && now < hm(c.end_time))
  const next = list.find((c) => hm(c.start_time) > now)

  async function mark(entry, status) {
    const existing = markFor(entry.id)
    const table = supabase.from('attendance_records')
    const { error } =
      existing?.status === status
        ? await table.delete().eq('id', existing.id) // tapping the same mark again undoes it
        : await table.upsert(
            { timetable_entry_id: entry.id, subject_id: entry.subject_id, class_date: today, status },
            { onConflict: 'timetable_entry_id,class_date' },
          )
    setError(error)
    if (!error) {
      marks.reload()
      summary.reload()
    }
  }

  const target = profile.data?.attendance_target ?? 75
  const margin = profile.data?.attendance_warn_margin ?? 5
  const flagged = (summary.data ?? [])
    .map((s) => ({ ...s, ...attendanceStats(s.attended, s.conducted, target, margin) }))
    .filter((s) => s.state === 'danger' || s.state === 'warning')

  const status = next
    ? `Next is ${next.subjects.name} at ${fmtTime(next.start_time)}.`
    : current
      ? `${current.subjects.name} is on now.`
      : "That's all for today."

  return (
    <>
      <h1 className="text-3xl font-bold">
        {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
      </h1>
      {!entries.loading && list.length > 0 && (
        <p className="mt-1 text-ink/70">
          {list.length} {list.length === 1 ? 'class' : 'classes'} today. {status}
        </p>
      )}

      {special.data && (
        <p className="mt-3 border-l-4 border-pen bg-ink/5 px-3 py-2 text-sm">
          {special.data.kind === 'holiday'
            ? `Holiday${special.data.note ? `: ${special.data.note}` : ''}. No weekly classes today.`
            : `Today follows ${DAYS[special.data.follows_day - 1]}'s timetable${special.data.note ? ` (${special.data.note})` : ''}.`}
        </p>
      )}

      {hidden > 0 && (
        <p className="mt-3 text-sm text-ink/70">
          {plural(hidden, 'class', 'classes')} for other lab batches {hidden === 1 ? 'is' : 'are'} hidden. Your batch is{' '}
          {myBatch}.{' '}
          <Link className="font-bold text-pen underline" to="/profile">Change it</Link>
        </p>
      )}

      <Problem error={error ?? entries.error ?? special.error ?? marks.error} />

      {!entries.loading && !special.loading && !profile.loading && list.length === 0 && !special.data && (
        <p className="mt-6 border-y border-rule py-4">
          Nothing on your timetable for today.{' '}
          <Link className="font-bold text-pen underline" to="/timetable">Open Timetable</Link> to add classes.
        </p>
      )}

      <ul className="mt-6 divide-y divide-rule border-y border-rule empty:hidden">
        {list.map((c) => {
          const m = markFor(c.id)
          return (
            <li key={c.id} className="border-l-4 py-4 pl-3" style={{ borderLeftColor: c.subjects.color }}>
              <div className="flex items-baseline gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-slab text-lg font-semibold tabular-nums">
                    {fmtTime(c.start_time)} to {fmtTime(c.end_time)}
                  </p>
                  <p className="truncate">
                    <span className="font-bold">{c.subjects.name}</span>
                    {c.on_date && <span className="ml-2 rounded-sm bg-mark-yellow px-1.5 text-sm font-bold">Extra</span>}
                    <BatchTag batch={c.batch} />
                    {[c.room, c.building].filter(Boolean).length > 0 && (
                      <span className="text-ink/70">, {[c.room, c.building].filter(Boolean).join(', ')}</span>
                    )}
                  </p>
                </div>
                {c === current && <span className="rounded-sm bg-pen px-1.5 py-0.5 text-sm font-bold text-white">Now</span>}
                {c === next && <span className="text-sm font-bold text-pen">Next</span>}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {MARKS.map(([value, text, on]) => (
                  <button
                    key={value}
                    onClick={() => mark(c, value)}
                    aria-pressed={m?.status === value}
                    className={`rounded-md border px-2 py-2 text-sm font-bold ${
                      m?.status === value ? `border-transparent ${on}` : 'border-rule bg-white text-ink/80 hover:border-ink/30'
                    }`}
                  >
                    {text}
                  </button>
                ))}
              </div>
            </li>
          )
        })}
      </ul>

      <ComingUp />

      {flagged.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-bold">Watch your attendance</h2>
          <ul className="mt-2 divide-y divide-rule border-y border-rule">
            {flagged.map((s) => (
              <li key={s.subject_id} className="flex items-center gap-3 py-3">
                <Percent value={s.pct} state={s.state} className="w-20" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{s.name}</p>
                  <p className="text-sm text-ink/70">{advice(s, target)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
