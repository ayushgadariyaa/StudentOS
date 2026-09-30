// Run with: npm test   (uses Node's built-in test runner, nothing to install)
import test from 'node:test'
import assert from 'node:assert/strict'
import { attendanceStats } from './attendance.js'

test('no classes yet means no state', () => {
  assert.equal(attendanceStats(0, 0, 75).state, 'none')
})

test('exactly on target is not a shortage', () => {
  const s = attendanceStats(3, 4, 75) // 75%
  assert.equal(s.state, 'warning')
  assert.equal(s.canSkip, 0)
})

test('below target: how many classes to attend in a row', () => {
  assert.equal(attendanceStats(6, 10, 75).needed, 6) // 12 of 16 = 75%
})

test('above target: how many classes can be skipped', () => {
  const s = attendanceStats(18, 20, 75) // 90%
  assert.equal(s.canSkip, 4) // 18 of 24 = 75%
  assert.equal(s.state, 'safe')
})

test('the warning zone is a few points above the target', () => {
  assert.equal(attendanceStats(79, 100, 75, 5).state, 'warning')
  assert.equal(attendanceStats(80, 100, 75, 5).state, 'safe')
})

test('a target of 100 is treated as 99 so the maths never divides by zero', () => {
  assert.ok(Number.isFinite(attendanceStats(9, 10, 100).needed))
})
