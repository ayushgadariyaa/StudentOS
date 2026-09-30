export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export const isoWeekday = (d = new Date()) => d.getDay() || 7 // Monday = 1 ... Sunday = 7
export const localDate = (d = new Date()) => d.toLocaleDateString('en-CA') // YYYY-MM-DD in local time
export const hm = (t) => t.slice(0, 5) // "09:30:00" -> "09:30"
export const fmtTime = (t) =>
  new Date(`1970-01-01T${hm(t)}`).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
