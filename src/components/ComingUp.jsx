import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useQuery } from '../lib/hooks'
import { daysFromToday, dueLabel, fmtDate } from '../lib/dates'
import { kindLabel } from '../lib/kinds'
import Mark from './Mark'
import Problem from './Problem'

const DAY = 86400000

// Task deadlines (not done yet, overdue ones included) and exams in the next two weeks, in date order.
export default function ComingUp() {
  const now = new Date()
  const inAWeek = new Date(now.getTime() + 7 * DAY).toISOString()
  const inTwoWeeks = new Date(now.getTime() + 14 * DAY).toISOString()

  const tasks = useQuery(() =>
    supabase.from('tasks').select('id, title, kind, deadline, subjects(name)').neq('status', 'done').lte('deadline', inAWeek).order('deadline').limit(10),
  )
  const exams = useQuery(() =>
    supabase.from('exams').select('id, title, exam_at, subjects(name)').gte('exam_at', now.toISOString()).lte('exam_at', inTwoWeeks).order('exam_at').limit(5),
  )

  const items = [
    ...(tasks.data ?? []).map((t) => ({
      key: `task-${t.id}`,
      when: t.deadline,
      title: t.title,
      detail: `${kindLabel(t.kind)}${t.subjects ? `, ${t.subjects.name}` : ''}`,
      to: '/tasks',
    })),
    ...(exams.data ?? []).map((x) => ({
      key: `exam-${x.id}`,
      when: x.exam_at,
      title: `${x.title || 'Exam'}: ${x.subjects.name}`,
      detail: 'Exam',
      to: '/exams',
    })),
  ].sort((a, b) => new Date(a.when) - new Date(b.when))

  if (items.length === 0 && !tasks.error && !exams.error) return null
  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold">Coming up</h2>
      <Problem error={tasks.error ?? exams.error} />
      <ul className="mt-2 divide-y divide-rule border-y border-rule">
        {items.map((item) => {
          const days = daysFromToday(item.when)
          return (
            <li key={item.key}>
              <Link to={item.to} className="flex items-center gap-3 py-3">
                <Mark tone={days < 0 ? 'bad' : days <= 1 ? 'warn' : 'quiet'} className="w-24 shrink-0 text-sm">
                  {dueLabel(days)}
                </Mark>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{item.title}</p>
                  <p className="text-sm text-ink/70">
                    {item.detail}, {fmtDate(item.when)}
                  </p>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
