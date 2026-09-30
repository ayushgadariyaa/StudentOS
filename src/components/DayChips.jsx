import { DAYS } from '../lib/dates'

// Pick one or more weekdays. `value` is a list of day numbers (1 = Monday ... 7 = Sunday).
export default function DayChips({ value, onChange }) {
  const toggle = (day) =>
    onChange(value.includes(day) ? value.filter((d) => d !== day) : [...value, day].sort((a, b) => a - b))

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Days">
        {DAYS.map((name, i) => {
          const day = i + 1
          const on = value.includes(day)
          return (
            <button
              key={name}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(day)}
              className={`rounded-md border px-3 py-2 text-sm font-bold ${
                on ? 'border-pen bg-pen text-white' : 'border-rule bg-white text-ink/80 hover:border-ink/30'
              }`}
            >
              {name.slice(0, 3)}
            </button>
          )
        })}
      </div>
      <button type="button" className="mt-2 text-sm font-bold text-pen underline" onClick={() => onChange([1, 2, 3, 4, 5])}>
        Select Monday to Friday
      </button>
    </div>
  )
}
