// Run with: npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import { classesOn } from './schedule.js'
import { datesBetween } from './dates.js'

// 2026-10-03 is a Saturday and 2026-10-05 is a Monday.
const entries = [
  { id: 'mon', on_date: null, day_of_week: 1, start_time: '09:00:00' },
  { id: 'sat', on_date: null, day_of_week: 6, start_time: '10:00:00' },
  { id: 'extra', on_date: '2026-10-03', day_of_week: 6, start_time: '08:00:00' },
]
const ids = (list) => list.map((e) => e.id)

test('a normal day shows its weekday classes plus extras for that date, in time order', () => {
  assert.deepEqual(ids(classesOn('2026-10-03', entries)), ['extra', 'sat'])
  assert.deepEqual(ids(classesOn('2026-10-05', entries)), ['mon'])
})

test('a holiday removes weekly classes but keeps extra classes', () => {
  assert.deepEqual(ids(classesOn('2026-10-03', entries, { kind: 'holiday' })), ['extra'])
})

test('a day that follows Monday uses Monday classes instead of its own', () => {
  const special = { kind: 'follows', follows_day: 1 }
  assert.deepEqual(ids(classesOn('2026-10-03', entries, special)), ['extra', 'mon'])
})

test('datesBetween lists every date, inclusive', () => {
  assert.deepEqual(datesBetween('2026-10-30', '2026-11-02'), ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'])
  assert.deepEqual(datesBetween('2026-10-03', '2026-10-03'), ['2026-10-03'])
  assert.deepEqual(datesBetween('2026-10-05', '2026-10-03'), [])
})

// Lab batches: a lecture has no batch, a lab is tagged with the batch that attends it.
const withLabs = [
  { id: 'lecture', on_date: null, day_of_week: 1, start_time: '09:00:00', batch: null },
  { id: 'lab-b1', on_date: null, day_of_week: 1, start_time: '14:00:00', batch: 'B1' },
  { id: 'lab-b2', on_date: null, day_of_week: 1, start_time: '14:00:00', batch: 'B2' },
  { id: 'extra-b2', on_date: '2026-10-05', day_of_week: 1, start_time: '16:00:00', batch: 'B2' },
]

test('a student sees the lectures and only the labs of their own batch', () => {
  assert.deepEqual(ids(classesOn('2026-10-05', withLabs, undefined, 'B2')), ['lecture', 'lab-b2', 'extra-b2'])
  assert.deepEqual(ids(classesOn('2026-10-05', withLabs, undefined, 'B1')), ['lecture', 'lab-b1'])
})

test('batch names match whatever the capitals or spaces', () => {
  assert.deepEqual(ids(classesOn('2026-10-05', withLabs, undefined, ' b 2 ')), ['lecture', 'lab-b2', 'extra-b2'])
})

test('a student with no batch set still sees every class', () => {
  assert.equal(classesOn('2026-10-05', withLabs, undefined).length, 4)
  assert.equal(classesOn('2026-10-05', withLabs, undefined, '').length, 4)
})
