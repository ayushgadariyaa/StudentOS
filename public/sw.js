// A minimal service worker. It exists so phones offer "Install app".
// It caches nothing, so people always get the newest deployed version of the app.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => {}) // required for installability; the browser handles requests as normal
