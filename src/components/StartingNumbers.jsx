import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { field, btn, btnQuiet } from '../lib/ui'
import Problem from './Problem'

// For a student who joined mid-semester: the classes attended and held BEFORE they started tracking here.
// They are stored on the subject (initial_attended / initial_conducted) and the app adds
// everything you mark on the Today page on top of them.
export default function StartingNumbers({ subject, onSaved }) {
  const [open, setOpen] = useState(false)
  const [attended, setAttended] = useState('')
  const [held, setHeld] = useState('')
  const [error, setError] = useState(null)

  function show() {
    setAttended(String(subject.initial_attended))
    setHeld(String(subject.initial_conducted))
    setError(null)
    setOpen(true)
  }

  async function save(e) {
    e.preventDefault()
    const a = Number(attended) || 0
    const h = Number(held) || 0
    if (a > h) return setError({ message: "Attended can't be more than held." })
    const { error } = await supabase
      .from('subjects')
      .update({ initial_attended: a, initial_conducted: h })
      .eq('id', subject.id)
    setError(error)
    if (!error) {
      setOpen(false)
      onSaved()
    }
  }

  if (!open) {
    return (
      <button className={`${btnQuiet} -ml-2.5`} onClick={show}>
        Set starting numbers
      </button>
    )
  }
  return (
    <form onSubmit={save} className="mt-2 rounded-md bg-ink/5 p-3">
      <p className="text-sm text-ink/70">Classes before you started tracking here. What you mark on Today is added on top.</p>
      <div className="mt-2 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          Attended
          <input type="number" min="0" className={`${field} mt-1 w-24`} value={attended} onChange={(e) => setAttended(e.target.value)} />
        </label>
        <label className="text-sm">
          Held
          <input type="number" min="0" className={`${field} mt-1 w-24`} value={held} onChange={(e) => setHeld(e.target.value)} />
        </label>
        <button className={btn}>Save</button>
        <button type="button" className={btnQuiet} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      <Problem error={error} />
    </form>
  )
}
