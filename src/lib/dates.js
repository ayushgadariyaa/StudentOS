// Small date and time helpers used across the app.
// Times from the database look like "09:30:00". Timestamps look like "2026-10-03T18:30:00+00:00".

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export const isoWeekday = (d = new Date()) => d.getDay() || 7 // Monday = 1 ... Sunday = 7
export const localDate = (d = new Date()) => d.toLocaleDateString('en-CA') // YYYY-MM-DD, in local time

export const hm = (t) => t.slice(0, 5) // "09:30:00" -> "09:30"

// A time of day such as "09:30:00" -> "9:30 AM" (uses the viewer's own 12h/24h preference)
export const fmtTime = (t) =>
  new Date(`1970-01-01T${hm(t)}`).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

// The clock time of a full timestamp
export const fmtClock = (stamp) => new Date(stamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

// A date such as "Fri, 3 Oct"
export const fmtDate = (stamp) =>
  new Date(stamp).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })

// "09:30" <-> minutes after midnight
export const toMinutes = (t) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
export const addMinutes = (t, n) => {
  const total = Math.min(Math.max(toMinutes(t) + n, 0), 23 * 60 + 59) // stay inside the same day
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

// Whole calendar days from today to a date: 0 = today, 1 = tomorrow, -1 = yesterday.
export function daysFromToday(stamp) {
  const d = new Date(stamp)
  const now = new Date()
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((a - b) / 86400000) // rounding copes with clocks changing for daylight saving
}

// "Overdue", "Today", "Tomorrow", "In 5 days"
export function dueLabel(days) {
  if (days < 0) return 'Overdue'
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `In ${days} days`
}
