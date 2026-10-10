import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useQuery } from '../lib/hooks'
import { plural } from '../lib/text'
import { btn, btnOutline, btnQuiet } from '../lib/ui'
import BatchTag from './BatchTag'
import Problem from './Problem'

// The admin tools for one class: the join code, sending your timetable, and the member list.
export default function ClassAdmin({ cls, userId, onChanged }) {
  const roster = useQuery(() => supabase.rpc('class_roster', { p_class: cls.id }))
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  const [copied, setCopied] = useState(false)

  // Runs a database action and refreshes the lists afterwards.
  async function act(action, done) {
    setError(null)
    setMessage(null)
    const { error } = await action
    if (error) return setError(error)
    if (done) setMessage(done)
    roster.reload()
    onChanged()
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(cls.join_code)
      setCopied(true)
    } catch {
      setCopied(false) // the code is on screen to read out
    }
  }

  const newCode = () => {
    if (confirm('Make a new code? The old code stops working for people who have not joined yet.')) {
      act(supabase.rpc('new_class_code', { p_class: cls.id }))
    }
  }

  // Send the classes and special days you already have (not the ones that came from a class) to this class.
  async function publish() {
    setError(null)
    setMessage(null)
    const classes = await supabase
      .from('timetable_entries').update({ publish_class_id: cls.id }).is('source_id', null).is('publish_class_id', null).select('id')
    if (classes.error) return setError(classes.error)
    const days = await supabase
      .from('calendar_days').update({ publish_class_id: cls.id }).is('source_id', null).is('publish_class_id', null).select('id')
    if (days.error) return setError(days.error)
    setMessage(`Sent ${plural(classes.data.length, 'class', 'classes')} and ${plural(days.data.length, 'special day')} to ${cls.name}.`)
  }

  async function unpublish() {
    if (!confirm(`Stop sending anything to ${cls.name}? Everyone's copies are removed the next time their app syncs.`)) return
    setError(null)
    for (const table of ['timetable_entries', 'calendar_days', 'tasks', 'exams']) {
      const { error } = await supabase.from(table).update({ publish_class_id: null }).eq('publish_class_id', cls.id)
      if (error) return setError(error)
    }
    setMessage(`Nothing is being sent to ${cls.name} any more.`)
  }

  const people = roster.data ?? []
  return (
    <details className="mt-6 border-y border-rule py-3">
      <summary className="cursor-pointer font-bold text-pen">Admin tools</summary>

      <div className="mt-4">
        <p className="text-sm text-ink/70">Share this code with your classmates so they can join.</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <span className="font-slab text-3xl font-bold tracking-[0.15em]">{cls.join_code}</span>
          <button className={btnQuiet} onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
          <button className={btnQuiet} onClick={newCode}>New code</button>
        </div>
      </div>

      <div className="mt-6">
        <p className="font-bold">Your timetable</p>
        <p className="mt-1 text-sm text-ink/70">
          New classes, holidays, tasks and exams you add are sent to this class when you tick "Also send to {cls.name}".
          To send what you already have:
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button className={btn} onClick={publish}>Send my timetable now</button>
          <button className={btnOutline} onClick={unpublish}>Stop sending</button>
        </div>
        <p className="mt-2 text-sm text-ink/70">
          When you mark one of these classes Cancelled on Today, you can tell the whole class in one tap.
        </p>
      </div>

      <div className="mt-6">
        <p className="font-bold">People ({people.length})</p>
        <Problem error={error ?? roster.error} />
        {message && <p className="mt-2 font-bold text-pen">{message}</p>}
        <ul className="mt-2 divide-y divide-rule border-y border-rule">
          {people.map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center gap-2 py-2">
              <div className="min-w-0 flex-1">
                <p className="font-bold">
                  {m.full_name || 'Unnamed'}
                  {m.role === 'admin' && <span className="ml-2 rounded-sm bg-mark-yellow px-1.5 text-sm font-bold">Admin</span>}
                  <BatchTag batch={m.batch} />
                </p>
                <p className="text-sm text-ink/70">{m.roll_number || 'No roll number'}</p>
              </div>
              {m.user_id !== userId && (
                <>
                  {m.role === 'member' && (
                    <button className={btnQuiet} onClick={() => act(supabase.rpc('set_member_role', { p_class: cls.id, p_user: m.user_id, p_role: 'admin' }))}>
                      Make admin
                    </button>
                  )}
                  {m.role === 'admin' && cls.is_creator && (
                    <button className={btnQuiet} onClick={() => act(supabase.rpc('set_member_role', { p_class: cls.id, p_user: m.user_id, p_role: 'member' }))}>
                      Remove admin rights
                    </button>
                  )}
                  {(m.role === 'member' || cls.is_creator) && (
                    <button
                      className={btnQuiet}
                      onClick={() => confirm(`Remove ${m.full_name || 'this person'} from the class?`) && act(supabase.rpc('remove_member', { p_class: cls.id, p_user: m.user_id }))}
                    >
                      Remove
                    </button>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
    </details>
  )
}
