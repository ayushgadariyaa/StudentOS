// Database tests for classes (migration 005). They run the real migrations on a real PostgreSQL engine
// (PGlite, no Supabase account needed) and play out a CR, a deputy CR and students joining, syncing, and leaving.
// Run with: npm run test:db
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const dir = fileURLToPath(new URL('../migrations', import.meta.url))
const db = new PGlite()
await db.exec(readFileSync(new URL('./stub.sql', import.meta.url), 'utf8'))
for (const f of readdirSync(dir).sort()) await db.exec(readFileSync(`${dir}/${f}`, 'utf8'))
await db.exec(`grant usage on schema public, auth to authenticated; grant all on all tables in schema public to authenticated;
               grant execute on function auth.uid() to authenticated;`)

const U = { cr: '00000000-0000-0000-0000-00000000000a', dcr: '00000000-0000-0000-0000-00000000000d',
            b1: '00000000-0000-0000-0000-0000000000b1', b2: '00000000-0000-0000-0000-0000000000b2',
            out: '00000000-0000-0000-0000-0000000000ff' }
for (const [k, id] of Object.entries(U)) await db.query(`insert into auth.users (id, raw_user_meta_data) values ($1, $2)`, [id, { full_name: k.toUpperCase() }])
await db.query(`update profiles set batch = 'B1' where id = $1`, [U.b1])
await db.query(`update profiles set batch = 'B2' where id = $1`, [U.b2])

// run SQL as a signed-in person, with Row Level Security on
async function as(who, sql, params = []) {
  await db.exec(`select set_config('request.jwt.claim.sub', '${U[who]}', false); set role authenticated;`)
  try { return (await db.query(sql, params)).rows } finally { await db.exec('reset role') }
}
const fails = async (who, sql, params, text) => {
  await assert.rejects(() => as(who, sql, params), (e) => (text ? e.message.includes(text) : true))
}
let passed = 0
const check = (name, fn) => fn().then(() => { passed++; console.log('ok  ', name) }, (e) => { console.log('FAIL', name, '\n     ', e.message); process.exitCode = 1 })

let cid, code
await check('CR creates a class and gets a code', async () => {
  cid = (await as('cr', `select create_class('CE 3A') as id`))[0].id
  const mine = await as('cr', `select * from my_classes()`)
  assert.equal(mine.length, 1); assert.equal(mine[0].role, 'admin'); assert.match(mine[0].join_code, /^[0-9A-F]{8}$/)
  code = mine[0].join_code
})
await check('members join with the code; a wrong code is refused', async () => {
  for (const w of ['dcr', 'b1', 'b2']) await as(w, `select join_class($1)`, [code.toLowerCase()])
  await fails('out', `select join_class('NOPE0000')`, [], 'No class found')
  const m = await as('b1', `select * from my_classes()`)
  assert.equal(m[0].role, 'member'); assert.equal(m[0].join_code, null); assert.equal(Number(m[0].member_count), 4)
})
await check('members cannot read the class table, the roster, or post notices', async () => {
  assert.equal((await as('b1', `select * from classes`)).length, 0)
  await fails('b1', `select * from class_roster($1)`, [cid], 'Only admins')
  await fails('b1', `insert into class_notices (class_id, title) values ($1, 'hi')`, [cid])
  await fails('b1', `select set_member_role($1, $2, 'admin')`, [cid, U.b1], 'Only admins')
})
await check('only the creator can promote or demote, others cannot remove admins', async () => {
  await as('cr', `select set_member_role($1, $2, 'admin')`, [cid, U.dcr])
  await fails('dcr', `select set_member_role($1, $2, 'member')`, [cid, U.dcr], 'Only the person who created')
  await fails('dcr', `select remove_member($1, $2)`, [cid, U.cr], 'Only the person who created')
  assert.equal((await as('cr', `select * from class_roster($1)`, [cid])).length, 4)
})

// CR publishes: a lecture, a B1 lab, a B2 lab, a holiday, a task, an exam
let lecture, labB1, labB2
await check('CR publishes classes, a holiday, a task and an exam', async () => {
  const subj = {}
  for (const [n, c] of [['Maths', '#2545C8'], ['Physics Lab', '#0E8A6B'], ['Chem Lab', '#C2410C']])
    subj[n] = (await as('cr', `insert into subjects (name, color) values ($1, $2) returning id`, [n, c]))[0].id
  const ins = async (s, day, batch) => (await as('cr', `insert into timetable_entries (subject_id, day_of_week, start_time, end_time, batch, publish_class_id)
      values ($1, $2, '09:00', '10:00', $3, $4) returning id`, [subj[s], day, batch, cid]))[0].id
  lecture = await ins('Maths', 1, null); labB1 = await ins('Physics Lab', 2, 'B1'); labB2 = await ins('Chem Lab', 3, 'B2')
  await as('cr', `insert into calendar_days (day, kind, note, publish_class_id) values ('2026-10-20', 'holiday', 'Diwali', $1)`, [cid])
  await as('cr', `insert into calendar_days (day, kind, follows_day, publish_class_id) values ('2026-10-17', 'follows', 1, $1)`, [cid])
  await as('cr', `insert into tasks (subject_id, kind, title, deadline, publish_class_id) values ($1, 'lab_manual', 'Manual 4', '2026-10-30T18:00Z', $2)`, [subj['Physics Lab'], cid])
  await as('cr', `insert into exams (subject_id, title, exam_at, publish_class_id) values ($1, 'Mid-sem', '2026-11-05T10:00Z', $2)`, [subj['Maths'], cid])
})
await check('B1 student syncs: lecture + B1 lab only, subjects match, holiday, task and exam arrive', async () => {
  assert.equal((await as('b1', `select sync_my_classes() as c`))[0].c, true)
  const e = await as('b1', `select s.name, t.batch, t.source_class_id from timetable_entries t join subjects s on s.id = t.subject_id order by s.name`)
  assert.deepEqual(e.map((r) => r.name), ['Maths', 'Physics Lab'])
  assert.equal((await as('b1', `select name from subjects order by name`)).map((r) => r.name).join(), 'Maths,Physics Lab')
  assert.equal((await as('b1', `select * from calendar_days`)).length, 2)
  assert.equal((await as('b1', `select title from tasks`))[0].title, 'Manual 4')
  assert.equal((await as('b1', `select title from exams`))[0].title, 'Mid-sem')
})
await check('B2 student gets the B2 lab, not the B1 lab', async () => {
  await as('b2', `select sync_my_classes()`)
  const e = await as('b2', `select s.name from timetable_entries t join subjects s on s.id = t.subject_id order by s.name`)
  assert.deepEqual(e.map((r) => r.name), ['Chem Lab', 'Maths'])
})
await check('a second sync changes nothing, and never duplicates', async () => {
  assert.equal((await as('b1', `select sync_my_classes() as c`))[0].c, false)
  assert.equal((await as('b1', `select count(*)::int as n from timetable_entries`))[0].n, 2)
})
await check('the DCR (another admin) receives the CR items too, but the CR is not duplicated', async () => {
  await as('dcr', `select sync_my_classes()`); await as('cr', `select sync_my_classes()`)
  assert.equal((await as('dcr', `select count(*)::int as n from timetable_entries where source_id is not null`))[0].n, 3)
  assert.equal((await as('cr', `select count(*)::int as n from timetable_entries`))[0].n, 3)
})
await check('members cannot see the CR rows directly (Row Level Security)', async () => {
  assert.equal((await as('b1', `select count(*)::int as n from timetable_entries where user_id = $1`, [U.cr]))[0].n, 0)
})
await check('edits flow through; my own progress on a task is kept', async () => {
  const taskCopy = (await as('b1', `select id from tasks`))[0].id
  await as('b1', `update tasks set status = 'done' where id = $1`, [taskCopy])
  await as('cr', `update timetable_entries set start_time = '11:00', end_time = '12:00' where id = $1`, [lecture])
  await as('cr', `update tasks set title = 'Manual 4 (revised)' where publish_class_id = $1`, [cid])
  assert.equal((await as('b1', `select sync_my_classes() as c`))[0].c, true)
  const t = (await as('b1', `select title, status from tasks`))[0]
  assert.deepEqual([t.title, t.status], ['Manual 4 (revised)', 'done'])
  assert.equal((await as('b1', `select start_time::text as s from timetable_entries t join subjects s on s.id = t.subject_id where s.name = 'Maths'`))[0].s, '11:00:00')
})
await check('a cancelled class shows as Cancelled for the right students, and un-cancelling removes it', async () => {
  const x = (await as('cr', `insert into class_cancellations (class_id, entry_id, class_date) values ($1, $2, '2026-10-26') returning id`, [cid, lecture]))[0].id
  await as('b1', `select sync_my_classes()`)
  let a = await as('b1', `select status from attendance_records where class_date = '2026-10-26'`)
  assert.deepEqual(a.map((r) => r.status), ['cancelled'])
  assert.equal((await as('b1', `select sync_my_classes() as c`))[0].c, false)
  // a student who marks it Present afterwards keeps their own mark
  await as('b1', `update attendance_records set status = 'present' where class_date = '2026-10-26'`)
  await as('b1', `select sync_my_classes()`)
  assert.equal((await as('b1', `select status from attendance_records where class_date = '2026-10-26'`))[0].status, 'present')
  await as('b1', `update attendance_records set status = 'cancelled' where class_date = '2026-10-26'`)
  await as('cr', `delete from class_cancellations where id = $1`, [x])
  await as('b1', `select sync_my_classes()`)
  assert.equal((await as('b1', `select count(*)::int as n from attendance_records`))[0].n, 0)
})
await check('a class marked Absent before it was cancelled becomes Cancelled', async () => {
  const copy = (await as('b2', `select t.id, t.subject_id from timetable_entries t join subjects s on s.id = t.subject_id where s.name = 'Maths'`))[0]
  await as('b2', `insert into attendance_records (subject_id, timetable_entry_id, class_date, status) values ($1, $2, '2026-11-02', 'absent')`, [copy.subject_id, copy.id])
  await as('cr', `insert into class_cancellations (class_id, entry_id, class_date) values ($1, $2, '2026-11-02')`, [cid, lecture])
  await as('b2', `select sync_my_classes()`)
  assert.equal((await as('b2', `select status from attendance_records where class_date = '2026-11-02'`))[0].status, 'cancelled')
})
await check('unpublishing or deleting removes copies; changing batch swaps the labs', async () => {
  await as('cr', `delete from exams where publish_class_id = $1`, [cid])
  await as('b1', `update profiles set batch = 'B2' where id = $1`, [U.b1])
  await as('b1', `select sync_my_classes()`)
  assert.equal((await as('b1', `select count(*)::int as n from exams`))[0].n, 0)
  const e = await as('b1', `select s.name from timetable_entries t join subjects s on s.id = t.subject_id order by s.name`)
  assert.deepEqual(e.map((r) => r.name), ['Chem Lab', 'Maths'])
})
await check('notices: admins post, members read; join code can be replaced', async () => {
  await as('dcr', `insert into class_notices (class_id, title, body) values ($1, 'Lab moved', 'Room 4')`, [cid])
  assert.equal((await as('b2', `select title from class_notices`))[0].title, 'Lab moved')
  assert.equal((await as('out', `select * from class_notices`)).length, 0)
  const nu = (await as('cr', `select new_class_code($1) as c`, [cid]))[0].c
  assert.notEqual(nu, code)
  await fails('out', `select join_class($1)`, [code], 'No class found')
})
await check('leave: copies go away, and removing a member cleans up on their next sync', async () => {
  await as('b2', `select leave_class($1)`, [cid])
  assert.equal((await as('b2', `select count(*)::int as n from timetable_entries`))[0].n, 0)
  assert.equal((await as('b2', `select count(*)::int as n from my_classes()`))[0].n, 0)
  await as('cr', `select remove_member($1, $2)`, [cid, U.b1])
  await as('b1', `select sync_my_classes()`)
  assert.equal((await as('b1', `select count(*)::int as n from timetable_entries`))[0].n, 0)
  await fails('cr', `select remove_member($1, $2)`, [cid, U.cr], 'Use Leave class')
})
await check('the only admin cannot leave a class that still has people; the last person out removes it', async () => {
  const c2 = (await as('out', `select create_class('Club')  as id`))[0].id
  const c2code = (await as('out', `select join_code from my_classes()`))[0].join_code
  await as('b2', `select join_class($1)`, [c2code])
  await fails('out', `select leave_class($1)`, [c2], 'only admin')
  await as('b2', `select leave_class($1)`, [c2])
  await as('out', `select leave_class($1)`, [c2])
  assert.equal((await db.query(`select count(*)::int as n from classes where id = $1`, [c2])).rows[0].n, 0)
})
console.log(passed, 'checks passed')
