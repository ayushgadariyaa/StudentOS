import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useQuery } from '../lib/hooks'
import { KINDS, kindLabel } from '../lib/kinds'
import { daysFromToday, dueLabel, fmtDate } from '../lib/dates'
import { field, btn, btnQuiet } from '../lib/ui'
import Field from '../components/Field'
import Mark from '../components/Mark'
import Problem from '../components/Problem'

// One list for all coursework (assignments, lab manuals, tutorials...) and personal to-dos.
// A personal to-do is just a task of kind "Other" with no subject.
const EMPTY = { kind: 'assignment', title: '', subject_id: '', date: '', time: '', priority: 'medium', description: '' }

export default function Tasks() {
  const tasks = useQuery(() => supabase.from('tasks').select('*, subjects(name, color)').order('deadline', { nullsFirst: false }))
  const subjects = useQuery(() => supabase.from('subjects').select('id, name').eq('archived', false).order('name'))
  const [form, setForm] = useState(EMPTY)
  const [filter, setFilter] = useState('all')
  const [error, setError] = useState(null)
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  async function add(e) {
    e.preventDefault()
    // A date with no time means "end of that day", so the task isn't overdue until the day is over.
    const deadline = form.date ? new Date(`${form.date}T${form.time || '23:59'}`).toISOString() : null
    const { error } = await supabase.from('tasks').insert({
      kind: form.kind,
      title: form.title.trim(),
      subject_id: form.subject_id || null,
      deadline,
      priority: form.priority,
      description: form.description.trim() || null,
    })
    setError(error)
    if (error) return
    setForm({ ...EMPTY, kind: form.kind }) // keep the type: lab manuals and tutorials often come in batches
    tasks.reload()
  }

  async function toggle(task) {
    const done = task.status !== 'done'
    const { error } = await supabase
      .from('tasks')
      .update({ status: done ? 'done' : 'todo', completed_at: done ? new Date().toISOString() : null })
      .eq('id', task.id)
    setError(error)
    if (!error) tasks.reload()
  }

  async function remove(task) {
    if (!confirm(`Remove "${task.title}"?`)) return
    const { error } = await supabase.from('tasks').delete().eq('id', task.id)
    setError(error)
    if (!error) tasks.reload()
  }

  const shown = (tasks.data ?? []).filter((t) => filter === 'all' || t.kind === filter)
  const open = shown.filter((t) => t.status !== 'done')
  const done = shown.filter((t) => t.status === 'done')
  const subjectList = subjects.data ?? []

  return (
    <>
      <h1 className="text-3xl font-bold">Tasks</h1>
      <p className="mt-1 text-ink/70">Assignments, lab manuals, tutorials and anything else you need to finish.</p>

      <details open className="mt-6 border-y border-rule py-3">
        <summary className="cursor-pointer font-bold text-pen">Add a task</summary>
        <form onSubmit={add} className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Type" htmlFor="kind">
            <select id="kind" className={field} value={form.kind} onChange={set('kind')}>
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Subject (optional)" htmlFor="subject">
            <select id="subject" className={field} value={form.subject_id} onChange={set('subject_id')}>
              <option value="">No subject</option>
              {subjectList.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>
          <Field label="What needs doing?" htmlFor="title" className="sm:col-span-2">
            <input id="title" required className={field} value={form.title} onChange={set('title')} placeholder="Experiment 4 write-up" />
          </Field>
          <Field label="Due date (optional)" htmlFor="date">
            <input id="date" type="date" className={field} value={form.date} onChange={set('date')} />
          </Field>
          <Field label="Due time (optional)" htmlFor="time" hint="Leave empty to mean the end of the day.">
            <input id="time" type="time" className={field} value={form.time} onChange={set('time')} />
          </Field>
          <Field label="Priority" htmlFor="priority">
            <select id="priority" className={field} value={form.priority} onChange={set('priority')}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </Field>
          <Field label="Notes (optional)" htmlFor="description" className="sm:col-span-2">
            <textarea id="description" rows="2" className={field} value={form.description} onChange={set('description')} />
          </Field>
          <div className="sm:col-span-2">
            <button className={btn}>Add task</button>
          </div>
        </form>
      </details>

      <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Filter by type">
        {[{ value: 'all', label: 'All' }, ...KINDS].map((k) => (
          <button
            key={k.value}
            onClick={() => setFilter(k.value)}
            aria-pressed={filter === k.value}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              filter === k.value ? 'border-pen bg-pen font-bold text-white' : 'border-rule bg-white text-ink/80 hover:border-ink/30'
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      <Problem error={error ?? tasks.error ?? subjects.error} />

      {!tasks.loading && open.length === 0 && (
        <p className="mt-6 border-y border-rule py-4">
          {filter === 'all' ? 'Nothing to do. Add a task above.' : `No open ${kindLabel(filter).toLowerCase()} tasks.`}
        </p>
      )}
      <ul className="mt-4 divide-y divide-rule border-y border-rule empty:hidden">
        {open.map((t) => (
          <TaskRow key={t.id} task={t} onToggle={toggle} onRemove={remove} />
        ))}
      </ul>

      {done.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer font-bold text-pen">Done ({done.length})</summary>
          <ul className="mt-2 divide-y divide-rule border-y border-rule">
            {done.map((t) => (
              <TaskRow key={t.id} task={t} onToggle={toggle} onRemove={remove} />
            ))}
          </ul>
        </details>
      )}
      {!subjects.loading && subjectList.length === 0 && (
        <p className="mt-6 text-sm text-ink/70">
          Tip: add your <Link className="font-bold text-pen underline" to="/subjects">subjects</Link> to link tasks to them.
        </p>
      )}
    </>
  )
}

function TaskRow({ task, onToggle, onRemove }) {
  const finished = task.status === 'done'
  const days = task.deadline ? daysFromToday(task.deadline) : null
  return (
    <li className="flex items-start gap-3 py-3">
      <input
        type="checkbox"
        checked={finished}
        onChange={() => onToggle(task)}
        aria-label={`Mark "${task.title}" as ${finished ? 'not done' : 'done'}`}
        className="mt-1.5 h-5 w-5 accent-pen"
      />
      <div className="min-w-0 flex-1">
        <p className={`font-bold ${finished ? 'text-ink/50 line-through' : ''}`}>{task.title}</p>
        <p className="text-sm text-ink/70">
          {kindLabel(task.kind)}
          {task.subjects && `, ${task.subjects.name}`}
          {task.priority === 'high' && ', high priority'}
        </p>
        {task.deadline && (
          <p className="mt-1 text-sm">
            {!finished && <Mark tone={days < 0 ? 'bad' : days <= 1 ? 'warn' : 'quiet'}>{dueLabel(days)}</Mark>}{' '}
            <span className="text-ink/70">Due {fmtDate(task.deadline)}</span>
          </p>
        )}
        {task.description && <p className="mt-1 text-sm">{task.description}</p>}
      </div>
      <button className={btnQuiet} onClick={() => onRemove(task)}>
        Remove
      </button>
    </li>
  )
}
