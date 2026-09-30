import Mark from './Mark'

const TONE = { safe: 'good', warning: 'warn', danger: 'bad', none: 'quiet' }

// An attendance percentage, highlighted green, yellow or red depending on the state from attendanceStats().
export default function Percent({ value, state, className = '' }) {
  return (
    <Mark tone={TONE[state]} className={className}>
      {value == null ? '–' : `${Number(value.toFixed(1))}%`}
    </Mark>
  )
}
