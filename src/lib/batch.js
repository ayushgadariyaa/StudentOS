// Lab batches. A timetable class can carry a batch such as "B1".
// No batch means the class is for everyone (a lecture). A class with a batch is only for that batch (a lab).
// Plain JavaScript, no screens. Tests: batch.test.js

// "b 1" -> "B1". Batch names are stored in capitals without spaces, so "b1", "B 1" and "B1" are the same batch.
export const normBatch = (value) => String(value ?? '').replace(/\s+/g, '').toUpperCase()

// Letters, digits, - and _, up to 20 characters, starting with a letter or digit. The database allows 20 at most.
const VALID = /^[A-Z0-9][A-Z0-9_-]{0,19}$/
export const isValidBatch = (batch) => VALID.test(batch)

export const BATCH_HELP = 'A batch name can use letters, numbers, - and _, up to 20 characters (for example B1).'

// Is this class for a student of batch `myBatch`?
// A class without a batch is for everyone. A student who has not chosen a batch yet sees every class,
// so nothing disappears until they choose.
export function matchesBatch(entry, myBatch) {
  const theirs = normBatch(entry.batch)
  const mine = normBatch(myBatch)
  return !theirs || !mine || theirs === mine
}

// A shared timetable comes from another person's browser, so we only look at a limited number of classes.
const entriesOf = (payload) => (Array.isArray(payload?.entries) ? payload.entries : []).slice(0, 200)

// The batch names found in a shared timetable, checked and sorted: ["B1", "B2", "B3"]. Empty if it has no labs.
export function batchesIn(payload) {
  const found = new Set()
  for (const e of entriesOf(payload)) {
    const tag = normBatch(e?.batch)
    if (isValidBatch(tag)) found.add(tag)
  }
  return [...found].sort()
}

// Which classes of a shared timetable are meant for a student of batch `batch` ('' = no lab batch)?
//  - classes without a batch (lectures) are for everyone
//  - a class with a batch is kept only when it is the student's batch
//  - a class with a malformed batch name is dropped instead of trusted
// Returns the classes to use (each with its checked batch as `tag`) and how many belonged to other batches.
export function pickClasses(payload, batch) {
  const chosen = normBatch(batch)
  const mine = []
  let otherBatch = 0
  for (const e of entriesOf(payload)) {
    if (!e || typeof e !== 'object') continue
    const tag = normBatch(e.batch)
    if (tag && !isValidBatch(tag)) continue
    if (tag && tag !== chosen) otherBatch++
    else mine.push({ ...e, tag })
  }
  return { mine, otherBatch }
}
