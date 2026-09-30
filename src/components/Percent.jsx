const MARK = { safe: 'bg-mark-green', warning: 'bg-mark-yellow', danger: 'bg-mark-red', none: 'bg-ink/10' }

// The one loud element in the app: a percentage that looks swiped with a highlighter.
export default function Percent({ value, state, className = '' }) {
  return (
    <span
      className={`inline-block -rotate-1 rounded-[3px_9px_4px_8px] px-2 py-0.5 text-center font-slab font-bold tabular-nums ${MARK[state]} ${className}`}
    >
      {value == null ? '–' : `${Number(value.toFixed(1))}%`}
    </span>
  )
}
