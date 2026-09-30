// The attendance maths. T = target %, a = attended, c = conducted (held).
// Cancelled classes are never counted. Comparisons use whole numbers (a * 100 < T * c) instead of
// dividing first, so exactly 75% is never mistaken for 74.99999%. Tests: attendance.test.js
export function attendanceStats(attended, conducted, target, margin = 5) {
  if (!conducted) return { pct: null, needed: 0, canSkip: 0, state: 'none' }
  const t = Math.min(Math.max(target, 1), 99) // 100% would divide by zero below
  const pct = (attended / conducted) * 100

  if (attended * 100 < t * conducted) {
    return {
      pct,
      needed: Math.ceil((t * conducted - 100 * attended) / (100 - t)), // classes to attend in a row
      canSkip: 0,
      state: 'danger',
    }
  }
  return {
    pct,
    needed: 0,
    canSkip: Math.max(0, Math.floor((100 * attended) / t - conducted)), // classes you can still miss
    state: attended * 100 < (t + margin) * conducted ? 'warning' : 'safe',
  }
}

const classes = (n) => `${n} class${n === 1 ? '' : 'es'}`

// One plain sentence telling the student what to do.
export function advice({ state, needed, canSkip }, target) {
  if (state === 'none') return 'Nothing counted yet. Mark classes on Today, or set your starting numbers.'
  if (state === 'danger') return `Attend the next ${classes(needed)} in a row to reach ${target}%.`
  if (canSkip === 0) return "Right at the limit. Don't skip the next class."
  return `You can skip ${classes(canSkip)} and still keep ${target}%.`
}
