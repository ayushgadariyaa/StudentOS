import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useQuery } from '../lib/hooks'
import { daysFromToday, dueLabel, fmtDate, fmtClock } from '../lib/dates'
import { field, btn, btnQuiet } from '../lib/ui'
import Field from '../components/Field'
import Mark from '../components/Mark'
import Problem from '../components/Problem'
import { useSendToClass } from '../components/SendToClass'
import { withClass } from '../lib/classes'

const STEPS = [0, 25, 50, 75, 100] // how prepared the student is, in percent
const EMPTY = { subject_id: '', title: '', date: '', time: '10:00', location: '' }
const tone = (days) => (days <= 2 ? 'bad' : days <= 7 ? 'warn' : 'quiet')

export default function Exams() {
  const exams = useQuery(() => supabase.from('exams').select('*, subjects(name, color)').order('exam_at'))
  const subjects = useQuery(() => supabase.from('subjects').select('id, name').eq('archived', false).order('name'))
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState(null)
  const send = useSendToClass(true) // class admins: also send this exam to the class
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  async function add(e) {
    e.preventDefault()
    const { error } = await supabase.from('exams').insert(withClass({
      subject_id: form.subject_id,
      title: form.title.trim() || null,
      exam_at: new Date(`${form.date}T${form.time}`).toISOString(),
      location: form.location.trim() || null,
    }, send.classId))
    setError(error)
    if (error) return
    setForm(EMPTY)
    exams.reload()
  }

  async function setPreparation(exam, value) {
    const { error } = await supabase.from('exams').update({ preparation: value }).eq('id', exam.id)
    setError(error)
    if (!error) exams.reload()
  }

  async function remove(exam) {
    if (!confirm('Remove this exam?')) return
    const { error } = await supabase.from('exams').delete().eq('id', exam.id)
    setError(error)
    if (!error) exams.reload()
  }

  const list = exams.data ?? []
  // An exam that started less than 3 hours ago still counts as today's.
  const cutoff = Date.now() - 3 * 3600 * 1000
  const upcoming = list.filter((x) => new Date(x.exam_at).getTime() >= cutoff)
  const past = list.filter((x) => new Date(x.exam_at).getTime() < cutoff).reverse()
  const subjectList = subjects.data ?? []

  return (
    <>
      <h1 className="text-3xl font-bold">Exams</h1>
      <p className="mt-1 text-ink/70">Dates, countdowns and how ready you are.</p>

      {!subjects.loading && subjectList.length === 0 ? (
        <p className="mt-6 border-y border-rule py-4">
          Add your subjects first, then come back to add exams.{' '}
          <Link className="font-bold text-pen underline" to="/subjects">Go to Subjects</Link>
        </p>
      ) : (
        <details open className="mt-6 border-y border-rule py-3">
          <summary className="cursor-pointer font-bold text-pen">Add an exam</summary>
          <form onSubmit={add} className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Subject" htmlFor="subject">
              <select id="subject" required className={field} value={form.subject_id} onChange={set('subject_id')}>
                <option value="" disabled>Choose a subject</option>
                {subjectList.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Which exam? (optional)" htmlFor="title">
              <input id="title" list="exam-titles" className={field} value={form.title} onChange={set('title')} placeholder="Mid-sem" />
              <datalist id="exam-titles">
                {['Mid-sem', 'End-sem', 'Internal', 'Practical', 'Viva', 'Quiz'].map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </Field>
            <Field label="Date" htmlFor="date">
              <input id="date" type="date" required className={field} value={form.date} onChange={set('date')} />
            </Field>
            <Field label="Time" htmlFor="time">
              <input id="time" type="time" required className={field} value={form.time} onChange={set('time')} />
            </Field>
            <Field label="Room or hall (optional)" htmlFor="location" className="sm:col-span-2">
              <input id="location" className={field} value={form.location} onChange={set('location')} />
            </Field>
            {send.control && <div className="sm:col-span-2">{send.control}</div>}
            <div className="sm:col-span-2">
              <button className={btn}>Add exam</button>
            </div>
          </form>
        </details>
      )}

      <Problem error={error ?? exams.error ?? subjects.error} />

      {!exams.loading && upcoming.length === 0 && (
        <p className="mt-6 border-y border-rule py-4">No upcoming exams. Add one above.</p>
      )}
      <ul className="mt-4 divide-y divide-rule border-y border-rule empty:hidden">
        {upcoming.map((x) => {
          const days = daysFromToday(x.exam_at)
          return (
            <li key={x.id} className="border-l-4 py-4 pl-3" style={{ borderLeftColor: x.subjects.color }}>
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-bold">
                    {x.subjects.name}
                    {x.title && `, ${x.title}`}
                  </p>
                  <p className="text-sm text-ink/70">
                    {fmtDate(x.exam_at)} at {fmtClock(x.exam_at)}
                    {x.location && `, ${x.location}`}
                  </p>
                </div>
                <Mark tone={tone(days)} className="shrink-0 text-sm">{dueLabel(days)}</Mark>
                {!x.source_id && (
                  <button className={btnQuiet} onClick={() => remove(x)}>
                    Remove
                  </button>
                )}
              </div>

              <div className="mt-3">
                <div className="flex items-center justify-between text-sm text-ink/70">
                  <span>How prepared are you?</span>
                  <span className="font-bold text-ink">{x.preparation}%</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-rule">
                  <div className="h-full rounded-full bg-pen" style={{ width: `${x.preparation}%` }} />
                </div>
                <div className="mt-2 grid grid-cols-5 gap-1.5" role="group" aria-label="Preparation progress">
                  {STEPS.map((v) => (
                    <button
                      key={v}
                      onClick={() => setPreparation(x, v)}
                      aria-pressed={x.preparation === v}
                      className={`rounded-md border py-1.5 text-sm font-bold ${
                        x.preparation === v ? 'border-pen bg-pen text-white' : 'border-rule bg-white text-ink/80 hover:border-ink/30'
                      }`}
                    >
                      {v}%
                    </button>
                  ))}
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      {past.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer font-bold text-pen">Past exams ({past.length})</summary>
          <ul className="mt-2 divide-y divide-rule border-y border-rule">
            {past.map((x) => (
              <li key={x.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-bold">
                    {x.subjects.name}
                    {x.title && `, ${x.title}`}
                  </p>
                  <p className="text-sm text-ink/70">{fmtDate(x.exam_at)}</p>
                </div>
                {!x.source_id && (
                  <button className={btnQuiet} onClick={() => remove(x)}>
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  )
}
