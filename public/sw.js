// HouseMate service worker: makes the app installable. It deliberately caches nothing,
// because showing stale balances offline is worse than a loading spinner (plan, section 4).
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => {
  // Network only: let the browser handle every request normally.
})
