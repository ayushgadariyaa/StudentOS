import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useQuery } from '../lib/hooks'
import { buildPayload, createShare, fetchShare, importPayload } from '../lib/share'
import { fmtDate } from '../lib/dates'
import { plural } from '../lib/text'
import { field, btn, btnQuiet } from '../lib/ui'
import Field from './Field'
import Problem from './Problem'

// Two halves: share your own timetable as a code, or add a classmate's timetable using their code.
// The logic lives in lib/share.js. This file is just the screen.
export default function TimetableShare({ subjects, entries, onImported }) {
  const profile = useQuery(() =>
    supabase.from('profiles').select('full_name, department, semester, division').maybeSingle(),
  )
  const shares = useQuery(() =>
    supabase.from('timetable_shares').select('code, expires_at').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }),
  )
  const [error, setError] = useState(null)
  const [typed, setTyped] = useState('') // the code typed by someone who wants to import
  const [preview, setPreview] = useState(null) // the timetable found for that code
  const [message, setMessage] = useState(null)
  const [copied, setCopied] = useState(null)

  async function share() {
    setError(null)
    const payload = buildPayload({ profile: profile.data, subjects, entries })
    if (payload.entries.length === 0) return setError({ message: 'Add some classes to your timetable first.' })
    const { error } = await createShare(payload)
    setError(error ?? null)
    if (!error) shares.reload()
  }

  async function stopSharing(code) {
    const { error } = await supabase.from('timetable_shares').delete().eq('code', code)
    setError(error ?? null)
    shares.reload()
  }

  async function copy(code) {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(code)
    } catch {
      setCopied(null) // clipboard not available, the code is still on screen to read out
    }
  }

  async function lookUp(e) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setPreview(null)
    const { payload, error } = await fetchShare(typed)
    if (error) return setError(error)
    if (!payload) {
      return setError({ message: "We couldn't find a timetable for that code. Check it, or ask for a new one. Codes expire after 30 days." })
    }
    setPreview(payload)
  }

  async function addToMine() {
    const result = await importPayload(preview, { subjects, entries })
    if (result.error) return setError(result.error)
    const skipped = result.skipped > 0 ? ` ${result.skipped} already in your timetable were skipped.` : ''
    setMessage(`Added ${plural(result.added, 'class', 'classes')} and ${plural(result.newSubjects, 'new subject')}.${skipped}`)
    setPreview(null)
    setTyped('')
    onImported()
  }

  return (
    <div className="mt-4 grid gap-8">
      <section>
        <h3 className="text-lg font-bold">Share your timetable</h3>
        <p className="mt-1 text-sm text-ink/70">
          Make a code your classmates can enter to copy your timetable. It includes your name, your department, semester and
          division, your subjects and your class timings. It never includes your attendance or roll number. Changed your
          timetable since? Make a new code.
        </p>
        <button className={`${btn} mt-3`} onClick={share}>
          Make a share code
        </button>
        <ul className="mt-3 divide-y divide-rule">
          {(shares.data ?? []).map((s) => (
            <li key={s.code} className="flex flex-wrap items-center gap-3 py-2">
              <span className="font-slab text-2xl font-bold tracking-[0.15em]">{s.code}</span>
              <span className="text-sm text-ink/70">expires {fmtDate(s.expires_at)}</span>
              <button className={btnQuiet} onClick={() => copy(s.code)}>
                {copied === s.code ? 'Copied' : 'Copy'}
              </button>
              <button className={btnQuiet} onClick={() => stopSharing(s.code)}>
                Stop sharing
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="text-lg font-bold">Use a classmate's timetable</h3>
        <form onSubmit={lookUp} className="mt-2 flex items-end gap-3">
          <Field label="Their code" htmlFor="share-code" className="flex-1">
            <input id="share-code" required maxLength={12} autoComplete="off" className={`${field} uppercase`} value={typed} onChange={(e) => setTyped(e.target.value)} />
          </Field>
          <button className={btn}>Look up</button>
        </form>

        {preview && (
          <div className="mt-4 border-l-4 border-pen bg-ink/5 px-3 py-3">
            <p className="font-bold">
              {preview.shared_by ? `Shared by ${preview.shared_by}` : 'Shared timetable'}
              {preview.class_label && `, ${preview.class_label}`}
            </p>
            <p className="text-sm text-ink/70">
              {plural((preview.entries ?? []).length, 'class', 'classes')} across {plural((preview.subjects ?? []).length, 'subject')}.
              Subjects and classes you already have are not added twice.
            </p>
            <div className="mt-3 flex gap-2">
              <button className={btn} onClick={addToMine}>
                Add to my timetable
              </button>
              <button className={btnQuiet} onClick={() => setPreview(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}
        {message && <p className="mt-3 font-bold">{message}</p>}
      </section>

      <Problem error={error ?? shares.error} />
    </div>
  )
}
