import { label as labelClass } from '../lib/ui'

// A label plus one form control (and an optional hint). Keeps every form short and consistent.
export default function Field({ label, htmlFor, hint, className = '', children }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-sm text-ink/70">{hint}</p>}
    </div>
  )
}
