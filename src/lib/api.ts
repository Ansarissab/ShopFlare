// Global API client — the single source of truth for talking to the CF Worker.
//
// DRY rule: never write `const WORKER_URL = process.env...` + raw `fetch()` in a
// component or page. Import `apiGet` / `apiPost` from here. Base URL, JSON
// headers, and non-2xx handling live in ONE place.
//
// 404 / status-specific handling: catch `ApiError` and inspect `.status`.

// Base URL of the CF Worker. In production this MUST be set (build-time env). In
// local dev it defaults to the standard `wrangler dev` port.
//
// Dev/prod isolation guard: in development we REFUSE a non-localhost origin so
// `next dev` can never read or write production data — even if a production
// NEXT_PUBLIC_WORKER_URL is left in `.env.local`. Set NEXT_PUBLIC_ALLOW_REMOTE_API=1
// to opt out (e.g. to point local dev at a staging worker on purpose).
export function resolveWorkerUrl(): string {
  const configured = process.env.NEXT_PUBLIC_WORKER_URL?.replace(/\/$/, '') ?? ''
  const isDev = process.env.NODE_ENV === 'development'
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(configured)

  if (isDev && configured && !isLocal && process.env.NEXT_PUBLIC_ALLOW_REMOTE_API !== '1') {
    console.warn(
      `[api] Ignoring non-local NEXT_PUBLIC_WORKER_URL (${configured}) in development to keep ` +
        `dev off production. Use http://localhost:8787, or set NEXT_PUBLIC_ALLOW_REMOTE_API=1 to override.`,
    )
    return 'http://localhost:8787'
  }
  if (configured) return configured
  return isDev ? 'http://localhost:8787' : ''
}

export const WORKER_URL = resolveWorkerUrl()

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// Per-call options. `headers` merges over the defaults (e.g. an
// `X-Turnstile-Token` on protected POSTs) so callers never reach for raw fetch.
export type ApiOptions = {
  headers?: Record<string, string>
  signal?: AbortSignal
}

// ---------------------------------------------------------------------------
// Admin session token (app-level auth)
// ---------------------------------------------------------------------------
// The admin API is gated by a Bearer session token (issued by /api/admin/login).
// It can't live in a cookie: the frontend and API run on separate *.workers.dev
// hosts and workers.dev is a public-suffix domain, so a shared cookie is blocked
// by browsers. We store the token in localStorage and attach it as a header.
const ADMIN_TOKEN_KEY = 'shopflare_admin_token'

export function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY)
  } catch {
    return null
  }
}

export function setAdminToken(token: string): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(ADMIN_TOKEN_KEY, token)
  } catch {
    /* storage disabled */
  }
}

export function clearAdminToken(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(ADMIN_TOKEN_KEY)
  } catch {
    /* storage disabled */
  }
}

// Protected admin endpoints — everything under /api/admin except the public login.
function isProtectedAdminPath(path: string): boolean {
  return path.startsWith('/api/admin') && !path.startsWith('/api/admin/login')
}

async function request<T>(path: string, init?: RequestInit & { signal?: AbortSignal }): Promise<T> {
  // Protected admin endpoints carry the session token as a Bearer header.
  const authHeader: Record<string, string> = {}
  if (isProtectedAdminPath(path)) {
    const token = getAdminToken()
    if (token) authHeader.Authorization = `Bearer ${token}`
  }

  const res = await fetch(`${WORKER_URL}${path}`, {
    ...init,
    headers: {
      // FormData bodies set their own multipart Content-Type boundary — don't
      // override. JSON string bodies get application/json.
      ...(typeof init?.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
      ...authHeader,
      ...init?.headers,
    },
  })

  if (!res.ok) {
    // Expired/invalid session on a protected admin call → drop token, bounce to login.
    if (res.status === 401 && isProtectedAdminPath(path) && typeof window !== 'undefined') {
      clearAdminToken()
      if (!window.location.pathname.startsWith('/admin/login')) {
        window.location.href = '/admin/login'
      }
    }
    const raw = await res.text()
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = undefined
    }
    const msg =
      parsed && typeof parsed === 'object' && parsed !== null
        ? ((parsed as Record<string, unknown>).error ??
          (parsed as Record<string, unknown>).message ??
          `HTTP ${res.status}`)
        : `HTTP ${res.status}`
    throw new ApiError(res.status, String(msg), parsed)
  }

  // Tolerate empty bodies (e.g. 204) without throwing on JSON.parse.
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

export function apiGet<T>(path: string, opts?: ApiOptions): Promise<T> {
  return request<T>(path, { headers: opts?.headers, signal: opts?.signal })
}

export function apiPost<T>(path: string, body?: unknown, opts?: ApiOptions): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: opts?.headers,
    signal: opts?.signal,
  })
}

export function apiPut<T>(path: string, body?: unknown, opts?: ApiOptions): Promise<T> {
  return request<T>(path, {
    method: 'PUT',
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: opts?.headers,
    signal: opts?.signal,
  })
}

export function apiDelete<T>(path: string, opts?: ApiOptions): Promise<T> {
  return request<T>(path, { method: 'DELETE', headers: opts?.headers, signal: opts?.signal })
}

export function apiPatch<T>(path: string, body?: unknown, opts?: ApiOptions): Promise<T> {
  return request<T>(path, {
    method: 'PATCH',
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: opts?.headers,
    signal: opts?.signal,
  })
}

// Multipart upload (FormData) — used for R2 image uploads. The browser sets the
// multipart Content-Type/boundary itself, so we pass the FormData straight through.
export function apiUpload<T>(path: string, form: FormData, opts?: ApiOptions): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body: form,
    headers: opts?.headers,
    signal: opts?.signal,
  })
}

// In-flight dedup — prevents burst fetches when user quickly hovers many cards.
const _prefetching = new Set<string>()

// Primes the browser HTTP cache for a public GET path (hover / viewport intent).
// Fire-and-forget: swallows all errors — never await.
export function prefetch(path: string): void {
  if (typeof window === 'undefined') return
  if (_prefetching.has(path)) return
  _prefetching.add(path)
  void fetch(WORKER_URL + path, { method: 'GET', cache: 'force-cache' })
    .catch(() => {})
    .finally(() => _prefetching.delete(path))
}

// ---------------------------------------------------------------------------
// Background Sync / offline queue
// ---------------------------------------------------------------------------
// IDB helper (inline, no library) — opens the offline queue database.
async function openOfflineDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('shopflare-offline', 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore('offline_queue', { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function enqueueOfflineRequest(
  url: string,
  body: unknown,
  headers?: Record<string, string>,
): Promise<void> {
  const db = await openOfflineDB()
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const entry = { id, url: `${WORKER_URL}${url}`, body: JSON.stringify(body), headers }

  return new Promise((resolve, reject) => {
    const tx = db.transaction('offline_queue', 'readwrite')
    tx.objectStore('offline_queue').add(entry)
    tx.oncomplete = () => {
      // Request background sync if supported
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        navigator.serviceWorker.ready
          .then((reg) => {
            return (
              reg as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } }
            ).sync?.register('offline-post-queue')
          })
          .catch(() => {})
      }
      resolve()
    }
    tx.onerror = () => reject(tx.error)
  })
}

/**
 * Drains any requests queued in IDB while offline and replays them.
 * Called automatically on the 'online' event (iOS fallback for Background Sync).
 */
export async function drainOfflineQueue(): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    const db = await openOfflineDB()
    const items: Array<{
      id: string
      url: string
      body: string
      headers?: Record<string, string>
    }> = await new Promise((resolve, reject) => {
      const tx = db.transaction('offline_queue', 'readonly')
      const req = tx.objectStore('offline_queue').getAll()
      req.onsuccess = () => resolve(req.result as typeof items)
      req.onerror = () => reject(req.error)
    })

    for (const item of items) {
      try {
        const res = await fetch(item.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...item.headers },
          body: item.body,
        })
        if (res.ok) {
          await new Promise<void>((resolve, reject) => {
            const tx = db.transaction('offline_queue', 'readwrite')
            const req = tx.objectStore('offline_queue').delete(item.id)
            req.onsuccess = () => resolve()
            req.onerror = () => reject(req.error)
          })
        }
      } catch {
        // Network still unavailable for this item — leave in queue
      }
    }
  } catch {
    // IDB unavailable — ignore
  }
}

// Registered once per page session; drains the IDB queue on reconnect for
// browsers that don't support Background Sync (e.g. iOS Safari).
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void drainOfflineQueue()
  })
}

/**
 * Like apiPost but queues the request in IndexedDB when offline,
 * replayed by the SW Background Sync when connectivity returns.
 * Returns null when queued (not sent immediately).
 */
export async function apiPostQueued<T>(
  path: string,
  body?: unknown,
  opts?: ApiOptions,
): Promise<T | null> {
  if (typeof window !== 'undefined' && !navigator.onLine) {
    await enqueueOfflineRequest(path, body, opts?.headers)
    return null
  }
  try {
    return await apiPost<T>(path, body, opts)
  } catch (err) {
    if (err instanceof TypeError && !navigator.onLine) {
      await enqueueOfflineRequest(path, body, opts?.headers)
      return null
    }
    throw err
  }
}
