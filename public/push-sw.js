// Imported into the generated service worker (see vite.config.js —
// workbox.importScripts) so push handling survives every autoUpdate rebuild
// of sw.js without needing to hand-maintain the whole file.

self.addEventListener('push', (event) => {
  let data
  try { data = event.data ? event.data.json() : {} } catch { data = {} }

  const title = data.title || 'Planner'
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    // Same tag on every due-today nudge, so a fresh one replaces the last
    // instead of stacking into a pile of a dozen by the end of the day.
    tag: 'planner-due',
    renotify: true,
    data: { url: data.url || '/' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of allClients) {
      if ('focus' in client) return client.focus()
    }
    if (self.clients.openWindow) return self.clients.openWindow(targetUrl)
  })())
})
