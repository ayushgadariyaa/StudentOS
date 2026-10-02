import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useQuery } from '../lib/hooks'
import { buildPayload, createShare, fetchShare, importPayload } from '../lib/share'
import { batchesIn, normBatch, pickClasses } from '../lib/batch'
import { fmtDate } from '../lib/dates'
import { plural } from '../lib/text'
import { field, btn, btnQuiet } from '../lib/ui'
import Field from './Field'
import Problem from './Problem'

const NO_BATCH = '-' // the choice "none of these"; it can never be a real batch name

// Two halves: share your own timetable as a code, or add a classmate's timetable using their code.
// The logic lives in lib/share.js. This file is just the screen.
export default function TimetableShare({ subjects, entries, onImported }) {
  const profile = useQuery(() =>
    supabase.from('profiles').select('id, full_name, department, semester, division, batch').maybeSingle(),
  )
  const shares = useQuery(() =>
    supabase.from('timetable_shares').select('code, expires_at').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }),
  )
  const [error, setError] = useState(null)
  const [typed, setTyped] = useState('') // the code typed by someone who wants to import
  const [preview, setPreview] = useState(null) // the timetable found for that code
  const [message, setMessage] = useState(null)
  const [copied, setCopied] = useState(null)
  const [batchChoice, setBatchChoice] = useState(null) // null = not chosen yet, NO_BATCH = lectures only

  // The batches this timetable has labs for. If there are any, the student must say which one is theirs.
  const batches = preview ? batchesIn(preview) : []
  const needsChoice = batches.length > 0 && batchChoice === null
  const chosen = batchChoice === NO_BATCH ? '' : (batchChoice ?? '')
  const picked = preview && !needsChoice ? pickClasses(preview, chosen).mine : []
  const pickedSubjects = new Set(picked.map((e) => String(e.subject ?? '').trim().toLowerCase())).size

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
    // Start with the batch from the profile, if this timetable has labs for it.
    const mine = normBatch(profile.data?.batch)
    setBatchChoice(batchesIn(payload).includes(mine) ? mine : null)
  }

  async function addToMine() {
    const result = await importPayload(preview, { subjects, entries, batch: chosen })
    if (result.error) return setError(result.error)
    const skipped = result.skipped > 0 ? ` ${result.skipped} already in your timetable were skipped.` : ''
    const others =
      result.otherBatch > 0 ? ` ${plural(result.otherBatch, 'class', 'classes')} for other batches were left out.` : ''

    // Today shows the labs of the batch saved in the profile. Save the chosen batch there if there is none yet.
    let batchNote = ''
    const saved = normBatch(profile.data?.batch)
    if (chosen && !saved && profile.data?.id) {
      const { error } = await supabase.from('profiles').update({ batch: chosen }).eq('id', profile.data.id)
      if (error) setError(error)
      else {
        profile.reload()
        batchNote = ` Your lab batch is now ${chosen}.`
      }
    } else if (chosen && saved && saved !== chosen) {
      batchNote = ` Your profile says batch ${saved}, so the ${chosen} labs stay hidden on Today until you change it in Profile.`
    }

    setMessage(`Added ${plural(result.added, 'class', 'classes')} and ${plural(result.newSubjects, 'new subject')}.${skipped}${others}${batchNote}`)
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
          division, your subjects, your class timings and the batch of each lab. It never includes your attendance or roll number. Changed your
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
            {batches.length > 0 && (
              <Field label="Which lab batch are you in?" htmlFor="import-batch" className="mt-3 max-w-xs">
                <select id="import-batch" className={field} value={batchChoice ?? ''} onChange={(e) => setBatchChoice(e.target.value)}>
                  <option value="" disabled>Choose your batch</option>
                  {batches.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                  <option value={NO_BATCH}>None of these (lectures only)</option>
                </select>
              </Field>
            )}
            <p className="mt-2 text-sm text-ink/70">
              {needsChoice
                ? 'This timetable has labs for more than one batch. Choose yours to see what will be added.'
                : `${plural(picked.length, 'class', 'classes')} across ${plural(pickedSubjects, 'subject')}. Subjects and classes you already have are not added twice.`}
            </p>
            <div className="mt-3 flex gap-2">
              <button className={btn} onClick={addToMine} disabled={needsChoice}>
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
