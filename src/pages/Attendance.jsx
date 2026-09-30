import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useQuery } from '../lib/hooks'
import { attendanceStats, advice } from '../lib/attendance'
import { field } from '../lib/ui'
import Percent from '../components/Percent'
import Problem from '../components/Problem'

export default function Attendance({ user }) {
  const summary = useQuery(() => supabase.from('attendance_summary').select('*').order('name'))
  const profile = useQuery(() =>
    supabase.from('profiles').select('attendance_target, attendance_warn_margin').maybeSingle(),
  )
  const [draft, setDraft] = useState(null) // what's typed in the target box before it's saved
  const [error, setError] = useState(null)

  const saved = profile.data?.attendance_target ?? 75
  const margin = profile.data?.attendance_warn_margin ?? 5
  const target = Math.min(99, Math.max(1, Number(draft) || saved))

  async function saveTarget() {
    if (draft === null) return
    const { error } = await supabase.from('profiles').update({ attendance_target: target }).eq('id', user.id)
    setError(error)
    await profile.reload()
    setDraft(null)
  }

  const rows = summary.data ?? []
  return (
    <>
      <h1 className="text-3xl font-bold">Attendance</h1>
      <div className="mt-3 flex items-center gap-3">
        <label htmlFor="target" className="text-ink/70">Minimum attendance you need</label>
        <div className="flex items-center gap-1">
          <input
            id="target"
            type="number"
            min="1"
            max="99"
            className={`${field} w-20`}
            value={draft ?? saved}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={saveTarget}
          />
          <span>%</span>
        </div>
      </div>

      <Problem error={error ?? summary.error} />

      {!summary.loading && rows.length === 0 && (
        <p className="mt-6 border-y border-rule py-4">
          No subjects yet. Add them in <Link className="font-bold text-pen underline" to="/subjects">Subjects</Link>, then
          mark your classes on the Today page.
        </p>
      )}

      <ul className="mt-6 divide-y divide-rule border-y border-rule empty:hidden">
        {rows.map((s) => {
          const stats = attendanceStats(s.attended, s.conducted, target, margin)
          return (
            <li key={s.subject_id} className="flex items-center gap-4 py-4">
              <Percent value={stats.pct} state={stats.state} className="w-24 text-2xl" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{s.name}</p>
                <p className="text-sm text-ink/70">
                  {s.attended} of {s.conducted} classes attended
                </p>
                <p className="mt-1 text-sm">{advice(stats, target)}</p>
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}
