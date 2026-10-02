// Run with: npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import { normBatch, isValidBatch, matchesBatch, batchesIn, pickClasses } from './batch.js'

test('batch names ignore capitals and spaces', () => {
  assert.equal(normBatch(' b 1 '), 'B1')
  assert.equal(normBatch(null), '')
  assert.equal(normBatch(undefined), '')
})

test('only simple batch names are valid', () => {
  assert.equal(isValidBatch('B1'), true)
  assert.equal(isValidBatch('A-2'), true)
  assert.equal(isValidBatch(''), false)
  assert.equal(isValidBatch('<SCRIPT>'), false)
  assert.equal(isValidBatch('B'.repeat(21)), false)
})

test('lectures are for everyone, labs only for their batch', () => {
  assert.equal(matchesBatch({ batch: null }, 'B2'), true)
  assert.equal(matchesBatch({ batch: 'B2' }, 'b2'), true)
  assert.equal(matchesBatch({ batch: 'B1' }, 'B2'), false)
})

test('a student with no batch sees every class', () => {
  assert.equal(matchesBatch({ batch: 'B1' }, null), true)
  assert.equal(matchesBatch({ batch: 'B1' }, ''), true)
})

const shared = {
  entries: [
    { subject: 'Maths', day: 1, start: '09:00', end: '10:00', batch: null },
    { subject: 'Physics Lab', day: 2, start: '14:00', end: '16:00', batch: 'B1' },
    { subject: 'Physics Lab', day: 3, start: '14:00', end: '16:00', batch: 'b2' },
    { subject: 'Chem Lab', day: 4, start: '14:00', end: '16:00', batch: '<script>' },
    { subject: 'Old class', day: 5, start: '09:00', end: '10:00' }, // shared before batches existed
    null,
  ],
}

test('batchesIn lists the valid batches once each, sorted', () => {
  assert.deepEqual(batchesIn(shared), ['B1', 'B2'])
  assert.deepEqual(batchesIn({}), [])
  assert.deepEqual(batchesIn(null), [])
})

test('pickClasses keeps lectures and the chosen batch, and drops the rest', () => {
  const b2 = pickClasses(shared, 'B2')
  assert.deepEqual(b2.mine.map((e) => e.subject), ['Maths', 'Physics Lab', 'Old class'])
  assert.equal(b2.mine[1].day, 3)
  assert.equal(b2.mine[1].tag, 'B2')
  assert.equal(b2.otherBatch, 1) // the B1 lab; the malformed one is dropped without being counted
})

test('choosing no batch imports lectures only', () => {
  const none = pickClasses(shared, '')
  assert.deepEqual(none.mine.map((e) => e.subject), ['Maths', 'Old class'])
  assert.equal(none.otherBatch, 2)
})
