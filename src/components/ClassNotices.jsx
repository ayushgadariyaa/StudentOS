import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useQuery } from '../lib/hooks'
import { fmtDate } from '../lib/dates'
import { field, btn, btnQuiet } from '../lib/ui'
import Field from './Field'
import Problem from './Problem'

// Notices from the class admins. On the Class tab it shows one class and lets admins post.
// On Today it shows the newest notices from all your classes (and nothing when there are none).
export default function ClassNotices({ classId, canPost = false, limit = 20, sinceDays, title = 'Notices' }) {
  const notices = useQuery(() => {
    let q = supabase.from('class_notices').select('*').order('created_at', { ascending: false }).limit(limit)
    if (classId) q = q.eq('class_id', classId)
    if (sinceDays) q = q.gte('created_at', new Date(Date.now() - sinceDays * 86400000).toISOString())
    return q
  })
  const [form, setForm] = useState({ title: '', body: '' })
  const [error, setError] = useState(null)
  const list = notices.data ?? []

  async function post(e) {
    e.preventDefault()
    const { error } = await supabase
      .from('class_notices')
      .insert({ class_id: classId, title: form.title.trim(), body: form.body.trim() || null })
    setError(error)
    if (error) return
    setForm({ title: '', body: '' })
    notices.reload()
  }

  async function remove(id) {
    const { error } = await supabase.from('class_notices').delete().eq('id', id)
    setError(error)
    if (!error) notices.reload()
  }

  if (!canPost && list.length === 0 && !notices.error) return null
  return (
    <section className="mt-6">
      <h3 className="text-lg font-bold">{title}</h3>
      {canPost && (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm font-bold text-pen">Post a notice</summary>
          <form onSubmit={post} className="mt-3 grid gap-3">
            <Field label="Title" htmlFor={`notice-title-${classId}`}>
              <input id={`notice-title-${classId}`} required maxLength={120} className={field} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </Field>
            <Field label="Message (optional)" htmlFor={`notice-body-${classId}`}>
              <textarea id={`notice-body-${classId}`} rows="3" maxLength={2000} className={field} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
            </Field>
            <div>
              <button className={btn}>Post to the class</button>
            </div>
          </form>
        </details>
      )}
      <Problem error={error ?? notices.error} />
      <ul className="mt-2 divide-y divide-rule border-y border-rule empty:hidden">
        {list.map((n) => (
          <li key={n.id} className="flex items-start gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-bold">{n.title}</p>
              {n.body && <p className="mt-1 whitespace-pre-line text-sm">{n.body}</p>}
              <p className="mt-1 text-sm text-ink/70">{fmtDate(n.created_at)}</p>
            </div>
            {canPost && (
              <button className={btnQuiet} onClick={() => remove(n.id)}>
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
