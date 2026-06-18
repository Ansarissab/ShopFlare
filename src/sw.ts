import { defaultCache } from '@serwist/next/worker'
import {
  Serwist,
  CacheFirst,
  StaleWhileRevalidate,
  NetworkFirst,
  ExpirationPlugin,
  CacheableResponsePlugin,
} from 'serwist'
import type { SerwistGlobalConfig } from 'serwist'

declare global {
  interface ServiceWorkerGlobalScope extends SerwistGlobalConfig {}
}

declare const self: ServiceWorkerGlobalScope

// ─── Runtime caching ─────────────────────────────────────────────────────────

const runtimeCaching = [
  // Immutable hashed static assets — cache forever
  {
    matcher: /^\/_next\/static\/.+/,
    handler: new CacheFirst({
      cacheName: 'shopflare-static-v1',
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({ maxAgeSeconds: 60 * 60 * 24 * 365 }),
      ],
    }),
  },
  // Google Fonts stylesheets
  {
    matcher: /^https:\/\/fonts\.googleapis\.com\/.+/,
    handler: new CacheFirst({
      cacheName: 'shopflare-fonts-css-v1',
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({ maxAgeSeconds: 60 * 60 * 24 * 365 }),
      ],
    }),
  },
  // Google Fonts binary files
  {
    matcher: /^https:\/\/fonts\.gstatic\.com\/.+/,
    handler: new CacheFirst({
      cacheName: 'shopflare-fonts-bin-v1',
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({ maxAgeSeconds: 60 * 60 * 24 * 365 }),
      ],
    }),
  },
  // Worker API — config + products (browse catalog offline)
  {
    matcher: ({ request, url }: { request: Request; url: URL }) =>
      request.method === 'GET' &&
      (/\/api\/config(\/.*)?$/.test(url.pathname) || /\/api\/products(\/.*)?$/.test(url.pathname)),
    handler: new StaleWhileRevalidate({
      cacheName: 'shopflare-api-v1',
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({ maxAgeSeconds: 60 * 60 * 24 * 7 }),
      ],
    }),
  },
  // Remote product images
  {
    matcher: ({ request, url }: { request: Request; url: URL }) =>
      request.destination === 'image' && url.protocol === 'https:',
    handler: new CacheFirst({
      cacheName: 'shopflare-images-v1',
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 7 }),
      ],
    }),
  },
  // Navigation / HTML pages — NetworkFirst with offline fallback
  {
    matcher: ({ request }: { request: Request }) => request.mode === 'navigate',
    handler: new NetworkFirst({
      cacheName: 'shopflare-pages-v1',
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({ maxAgeSeconds: 60 * 60 * 24 }),
      ],
      networkTimeoutSeconds: 3,
    }),
  },
  // Serwist default cache strategies last
  ...defaultCache,
]

// ─── Serwist instance ─────────────────────────────────────────────────────────

const serwist = new Serwist({
  precacheEntries: [{ url: '/offline', revision: '1' }],
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching,
  fallbacks: {
    entries: [{ url: '/offline', matcher: ({ request }) => request.mode === 'navigate' }],
  },
})

serwist.addEventListeners()

// ─── Manual skipWaiting via message ──────────────────────────────────────────

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// ─── Push notifications ───────────────────────────────────────────────────────

self.addEventListener('push', (event: PushEvent) => {
  const fallbackTitle = 'New order received'
  const fallbackBody = ''
  const fallbackUrl = '/admin/orders'

  let title = fallbackTitle
  let body = fallbackBody
  let url = fallbackUrl

  if (event.data) {
    try {
      const payload = event.data.json() as Record<string, unknown>

      // iOS 18.4+ Declarative Web Push: payload has an `image` key — already
      // rendered by the browser, nothing for us to do.
      if ('image' in payload) {
        return
      }

      title = (payload.title as string | undefined) ?? fallbackTitle
      body = (payload.body as string | undefined) ?? fallbackBody
      url = (payload.url as string | undefined) ?? fallbackUrl
    } catch {
      // non-JSON data — use fallbacks
    }
  }

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, {
        body,
        data: { url },
        icon: '/icon-192.png',
        badge: '/icon-monochrome-192.png',
      })
      // Badging API — increment home screen icon badge (iOS 16.4+, Chrome 81+)
      if ('setAppBadge' in (self as unknown as { setAppBadge?: unknown })) {
        try {
          await (self as unknown as { setAppBadge(): Promise<void> }).setAppBadge()
        } catch {
          /* not supported on this device */
        }
      }
    })(),
  )
})

// ─── Notification click ───────────────────────────────────────────────────────

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()

  const targetUrl: string =
    (event.notification.data as { url?: string } | null)?.url ?? '/admin/orders'

  event.waitUntil(
    (self.clients as Clients)
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === targetUrl && 'focus' in client) {
            return (client as WindowClient).focus()
          }
        }
        return (self.clients as Clients).openWindow(targetUrl)
      }),
  )
})

// ─── Background Sync — offline POST queue ────────────────────────────────────

interface QueuedRequest {
  id: string
  url: string
  body: string
  headers: Record<string, string>
}

/** Minimal IndexedDB helper — no library dependency. */
function openOfflineQueueDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('shopflare-offline', 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore('offline_queue', { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function getAllQueued(db: IDBDatabase): Promise<QueuedRequest[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('offline_queue', 'readonly')
    const req = tx.objectStore('offline_queue').getAll()
    req.onsuccess = () => resolve(req.result as QueuedRequest[])
    req.onerror = () => reject(req.error)
  })
}

function removeQueued(db: IDBDatabase, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('offline_queue', 'readwrite')
    const req = tx.objectStore('offline_queue').delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

self.addEventListener('sync', (event: SyncEvent) => {
  if (event.tag === 'offline-post-queue') {
    event.waitUntil(
      (async () => {
        const db = await openOfflineQueueDB()
        const items = await getAllQueued(db)

        for (const item of items) {
          try {
            const res = await fetch(item.url, {
              method: 'POST',
              headers: item.headers,
              body: item.body,
            })
            if (res.ok) {
              await removeQueued(db, item.id)
            }
            // non-ok response: leave in queue for next sync attempt
          } catch {
            // network error: leave in queue
          }
        }
      })(),
    )
  }
})
