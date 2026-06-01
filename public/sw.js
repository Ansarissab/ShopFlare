// Service worker — minimal push + notificationclick handlers.
// Agent O — Web Push support for merchant order notifications.
//
// The SW receives pushes from the CF Worker (sendPushToAll).
// Payload is JSON: { title, body, url? }
// Falls back to generic copy if no payload is present.

const GENERIC_TITLE = 'New order received'
const GENERIC_BODY = ''
const ADMIN_ORDERS_PATH = '/admin/orders'

self.addEventListener('push', (event) => {
  let title = GENERIC_TITLE
  let body = GENERIC_BODY
  let url = ADMIN_ORDERS_PATH

  if (event.data) {
    try {
      const payload = event.data.json()
      if (payload.title) title = payload.title
      if (payload.body) body = payload.body
      if (payload.url) url = payload.url
    } catch {
      // Malformed payload — use generic copy
    }
  }

  const options = {
    body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: { url },
    requireInteraction: false,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl = event.notification.data?.url || ADMIN_ORDERS_PATH

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // If a window with the target URL is already open, focus it
        for (const client of windowClients) {
          if (client.url.includes(targetUrl) && 'focus' in client) {
            return client.focus()
          }
        }
        // Otherwise open a new window
        if (clients.openWindow) {
          return clients.openWindow(targetUrl)
        }
      }),
  )
})
