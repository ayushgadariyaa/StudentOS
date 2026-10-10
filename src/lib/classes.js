import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useQuery } from './hooks'

// Classes (groups) run by a CR. Everything that touches the database lives in supabase/migrations/005_classes.sql;
// these are the small helpers the screens use.

// The classes this person is in: [{ id, name, role, member_count, join_code (admins only), admins, is_creator }]
export function useMyClasses() {
  const q = useQuery(() => supabase.rpc('my_classes'))
  return { classes: q.data ?? [], loading: q.loading, error: q.error, reload: q.reload }
}

// A row that an admin sends to their class. The three columns are filled in only when it is being sent, so people
// who are not admins never send a column that an older database does not have. source_id and source_class_id are
// emptied because this row is an original, not a copy that came from a class.
export const withClass = (row, classId) =>
  classId ? { ...row, publish_class_id: classId, source_id: null, source_class_id: null } : row

// Asks the database to copy the class's latest classes, holidays, tasks, exams and cancellations onto this
// student's own screens. Returns true when something changed.
export async function syncMyClasses() {
  const { data, error } = await supabase.rpc('sync_my_classes')
  if (error) {
    console.warn('Class sync skipped:', error.message) // for example: migration 005 has not been run yet
    return false
  }
  return data === true
}

// Runs the sync when the app opens, every 5 minutes, and when the person comes back to the tab.
// Returns a number that goes up whenever the sync changed something, so the screens can reload.
export function useClassSync(userId) {
  const [version, setVersion] = useState(0)
  useEffect(() => {
    if (!userId) return
    let last = 0
    async function run() {
      last = Date.now()
      if (await syncMyClasses()) setVersion((v) => v + 1)
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - last > 60_000) run()
    }
    run()
    const timer = setInterval(run, 5 * 60_000)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [userId])
  return version
}
