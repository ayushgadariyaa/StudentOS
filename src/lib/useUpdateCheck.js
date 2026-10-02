import { useEffect, useState } from 'react'

// How the app notices that a new version has been deployed.
// When the code changes, Vite gives the built files new names (for example /assets/index-Bx3k9.js) and index.html
// points at them. So we note the file names this page was loaded with, now and then read the live index.html,
// and compare. A different list means a newer version is out. Nothing to set up at build time.
const fileList = (doc) =>
  [...doc.querySelectorAll('script[src*="/assets/"], link[rel="stylesheet"][href*="/assets/"]')]
    .map((el) => el.getAttribute('src') ?? el.getAttribute('href'))
    .sort()
    .join('|')

// Returns true once a newer version is available. Checks when the app opens, every 5 minutes,
// and whenever the person comes back to the tab.
export function useUpdateAvailable() {
  const [stale, setStale] = useState(false)

  useEffect(() => {
    if (stale || !import.meta.env.PROD) return // while developing there are no named files to compare
    const mine = fileList(document)
    if (!mine) return

    async function check() {
      if (document.visibilityState === 'hidden') return
      try {
        // A new address every time and no cache, so we see what is deployed right now.
        const res = await fetch(`/?check=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) return
        const live = fileList(new DOMParser().parseFromString(await res.text(), 'text/html'))
        if (live && live !== mine) setStale(true)
      } catch {
        // offline: try again later
      }
    }

    check()
    const timer = setInterval(check, 5 * 60 * 1000)
    document.addEventListener('visibilitychange', check)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
    }
  }, [stale])

  return stale
}

// Tapping the banner: forget any saved copy of the old app (the service worker and its caches), then reload.
export async function refreshApp() {
  try {
    const registrations = (await navigator.serviceWorker?.getRegistrations?.()) ?? []
    await Promise.all(registrations.map((r) => r.unregister()))
    if ('caches' in window) {
      for (const name of await caches.keys()) await caches.delete(name)
    }
  } catch {
    // if this fails, the reload below still works in most cases
  }
  location.reload()
}
