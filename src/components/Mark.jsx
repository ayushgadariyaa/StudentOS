const TONE = { good: 'bg-mark-green', warn: 'bg-mark-yellow', bad: 'bg-mark-red', quiet: 'bg-ink/10' }

// A short label that looks swiped with a highlighter pen. Used for values that need attention.
export default function Mark({ tone = 'quiet', className = '', children }) {
  return (
    <span
      className={`inline-block -rotate-1 rounded-[3px_9px_4px_8px] px-2 py-0.5 text-center font-slab font-bold tabular-nums ${TONE[tone]} ${className}`}
    >
      {children}
    </span>
  )
}
