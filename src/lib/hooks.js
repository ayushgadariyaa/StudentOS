import { useCallback, useEffect, useState } from 'react'

// Runs a Supabase query when a page opens. Returns { data, loading, error, reload }.
export function useQuery(run) {
  const [state, setState] = useState({ data: null, loading: true, error: null })
  const reload = useCallback(async () => {
    const { data, error } = await run()
    setState({ data, loading: false, error })
  }, [])
  useEffect(() => {
    reload()
  }, [reload])
  return { ...state, reload }
}
