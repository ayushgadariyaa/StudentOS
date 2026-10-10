import { useId, useState } from 'react'
import { useMyClasses } from '../lib/classes'
import { field } from '../lib/ui'
import Field from './Field'

// For class admins (the CR, a deputy CR): "also send this to my class". Everyone else sees nothing at all.
// How to use it in a form:
//   const send = useSendToClass(true)                 // true = ticked at first
//   insert(withClass(row, send.classId))              // saves the row for the class too, when ticked
//   {send.control}                                    // the tick box (or a menu, if you run several classes)
export function useSendToClass(defaultOn = true) {
  const { classes } = useMyClasses()
  const id = useId()
  const admin = classes.filter((c) => c.role === 'admin')
  const [chosen, setChosen] = useState(undefined) // undefined = not touched yet, null = just me, otherwise a class id
  const classId = chosen !== undefined ? chosen : defaultOn && admin.length === 1 ? admin[0].id : null

  let control = null
  if (admin.length === 1) {
    control = (
      <label className="flex items-center gap-3 border-l-4 border-pen bg-ink/5 px-3 py-2">
        <input
          type="checkbox"
          className="h-5 w-5 accent-pen"
          checked={classId !== null}
          onChange={(e) => setChosen(e.target.checked ? admin[0].id : null)}
        />
        <span>Also send to {admin[0].name}</span>
      </label>
    )
  } else if (admin.length > 1) {
    control = (
      <Field label="Send to" htmlFor={id}>
        <select id={id} className={field} value={classId ?? ''} onChange={(e) => setChosen(e.target.value || null)}>
          <option value="">Just me</option>
          {admin.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </Field>
    )
  }
  return { classId, control }
}
