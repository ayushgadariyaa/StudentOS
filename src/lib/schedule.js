import { isoWeekday } from './dates.js'
import { matchesBatch } from './batch.js'

// Which classes happen on a given date? Four things decide it:
//  1. the weekly timetable (entries with no on_date)
//  2. a special day: a holiday has no weekly classes; a day that "follows" another weekday uses THAT weekday's classes
//  3. extra classes (entries with an on_date) always appear on their own date
//  4. the student's lab batch: a class tagged with another batch is left out (no batch tag = for everyone)
// dateStr is "YYYY-MM-DD". special is the calendar_days row for that date, or undefined.
// myBatch is the student's lab batch, or empty to keep every class. Tests: schedule.test.js
export function classesOn(dateStr, entries, special, myBatch) {
  const mine = entries.filter((e) => matchesBatch(e, myBatch))
  const weekday = special?.kind === 'follows' ? special.follows_day : isoWeekday(new Date(`${dateStr}T00:00`))
  const weekly = special?.kind === 'holiday' ? [] : mine.filter((e) => !e.on_date && e.day_of_week === weekday)
  const extra = mine.filter((e) => e.on_date === dateStr)
  return [...weekly, ...extra].sort((a, b) => a.start_time.localeCompare(b.start_time))
}
