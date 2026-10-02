import { supabase } from './supabase'
import { hm } from './dates'
import { PALETTE } from './colors'
import { normBatch, pickClasses } from './batch'

// How timetable sharing works
//  1. Sharing saves a SNAPSHOT of your subjects and classes in the timetable_shares table, under a short code.
//  2. A classmate types the code. The database function get_shared_timetable(code) returns that snapshot.
//     Classmates can never list or browse other people's shares, only fetch one by its exact code.
//  3. Their app adds those subjects and classes to THEIR OWN tables. Nothing stays linked to you.
//  4. Labs carry a batch tag ("B1"). The classmate picks their batch and only gets the lectures plus that batch's labs.

// No 0/O or 1/I, so a code is easy to read out loud in class.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function newCode(length = 8) {
  const bytes = crypto.getRandomValues(new Uint8Array(length)) // secure random numbers
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}

const TIME = /^\d{2}:\d{2}$/
const COLOR = /^#[0-9a-fA-F]{6}$/
const clean = (value, max = 100) => String(value ?? '').trim().slice(0, max)

// What gets shared: your name, your class details, your subjects, class timings and the batch of each lab.
// Never your attendance or roll number.
export function buildPayload({ profile, subjects, entries }) {
  const used = new Set(entries.map((e) => e.subject_id))
  return {
    shared_by: profile?.full_name ?? null,
    class_label: [profile?.department, profile?.semester, profile?.division].filter(Boolean).join(', ') || null,
    subjects: subjects.filter((s) => used.has(s.id)).map(({ name, code, color }) => ({ name, code, color })),
    entries: entries.map((e) => ({
      subject: e.subjects.name,
      day: e.day_of_week,
      start: hm(e.start_time),
      end: hm(e.end_time),
      room: e.room,
      building: e.building,
      professor: e.professor,
      batch: normBatch(e.batch) || null,
    })),
  }
}

export async function createShare(payload) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newCode()
    const { error } = await supabase.from('timetable_shares').insert({ code, payload })
    if (!error) return { code }
    if (error.code !== '23505') return { error } // 23505 = this code already exists, so try another one
  }
  return { error: { message: 'Could not make a code. Please try again.' } }
}

export async function fetchShare(code) {
  const { data, error } = await supabase.rpc('get_shared_timetable', { share_code: code })
  return { payload: data, error }
}

// Adds a classmate's timetable to ours. Subjects with the same name are reused,
// and classes we already have are skipped. The payload came from another person's browser,
// so every value is checked before it is used.
// `batch` is OUR lab batch ('' for none): we get the lectures plus the labs of that batch, never other batches' labs.
export async function importPayload(payload, { subjects, entries, batch }) {
  const subjectIds = new Map(subjects.map((s) => [s.name.trim().toLowerCase(), s.id]))

  // 0. Keep only the classes meant for us (see pickClasses in batch.js).
  const { mine, otherBatch } = pickClasses(payload, batch)
  const needed = new Set(mine.map((e) => clean(e.subject).toLowerCase()))

  // 1. Create the subjects we don't have yet, but only the ones our own classes use.
  const toCreate = new Map()
  for (const s of (payload.subjects ?? []).slice(0, 50)) {
    const name = clean(s.name)
    const key = name.toLowerCase()
    if (name && needed.has(key) && !subjectIds.has(key) && !toCreate.has(key)) {
      toCreate.set(key, { name, code: clean(s.code, 30) || null, color: COLOR.test(s.color) ? s.color : PALETTE[0] })
    }
  }
  if (toCreate.size > 0) {
    const { data, error } = await supabase.from('subjects').insert([...toCreate.values()]).select('id, name')
    if (error) return { error }
    data.forEach((s) => subjectIds.set(s.name.trim().toLowerCase(), s.id))
  }

  // 2. Add the classes, skipping any we already have: the same subject, day and times, with either no batch on
  //    ours or the same batch. (A class added before batches existed counts as being for everyone.)
  const slot = (id, day, start, end) => `${id}|${day}|${start}|${end}`
  const have = new Set(
    entries.map((e) => `${slot(e.subject_id, e.day_of_week, hm(e.start_time), hm(e.end_time))}|${normBatch(e.batch)}`),
  )
  const rows = []
  for (const e of mine) {
    const subject_id = subjectIds.get(clean(e.subject).toLowerCase())
    const day = Number(e.day)
    const valid = subject_id && day >= 1 && day <= 7 && TIME.test(e.start) && TIME.test(e.end) && e.end > e.start
    if (!valid) continue
    const where = slot(subject_id, day, e.start, e.end)
    if (have.has(`${where}|`) || have.has(`${where}|${e.tag}`)) continue
    have.add(`${where}|${e.tag}`)
    rows.push({
      subject_id,
      day_of_week: day,
      start_time: e.start,
      end_time: e.end,
      room: clean(e.room) || null,
      building: clean(e.building) || null,
      professor: clean(e.professor) || null,
      batch: e.tag || null,
    })
  }
  if (rows.length > 0) {
    const { error } = await supabase.from('timetable_entries').insert(rows)
    if (error) return { error }
  }
  return { added: rows.length, newSubjects: toCreate.size, skipped: mine.length - rows.length, otherBatch }
}
