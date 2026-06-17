// Typed server-side GET helper — wraps fetch() with worker base URL + cache control.
// Use only in async server components and generateMetadata functions (never in
// 'use client' code — for client fetches use lib/api.ts).

import { resolveWorkerUrl } from '@/lib/worker-url'

// Resolve the worker origin through the SAME shared guard the client (lib/api.ts)
// and the CSP (next.config.ts) use, so server-rendered pages can never silently
// read PRODUCTION data in dev. Without this, a production NEXT_PUBLIC_WORKER_URL
// left in env makes `next dev` server components fetch prod (e.g. a category that
// only exists locally 404s), while the client correctly hits localhost.
// Read each env var as a static member access and resolve lazily so tests can
// stub NEXT_PUBLIC_WORKER_URL per-call via vi.stubEnv.
let warnedRemote = false
function serverWorkerUrl(): string {
  return resolveWorkerUrl(
    {
      NEXT_PUBLIC_WORKER_URL: process.env.NEXT_PUBLIC_WORKER_URL,
      NODE_ENV: process.env.NODE_ENV,
      NEXT_PUBLIC_ALLOW_REMOTE_API: process.env.NEXT_PUBLIC_ALLOW_REMOTE_API,
    },
    (configured) => {
      if (warnedRemote) return
      warnedRemote = true
      console.warn(
        `[fetchFromWorker] Ignoring non-local NEXT_PUBLIC_WORKER_URL (${configured}) in development ` +
          `to keep dev off production. Using http://localhost:8787; set NEXT_PUBLIC_ALLOW_REMOTE_API=1 to override.`,
      )
    },
  )
}

/** Convert an R2 key to its public CDN URL (server-side only). */
export function r2Url(key: string | null | undefined): string | null {
  if (!key) return null
  return `${serverWorkerUrl()}/cdn/${key}`
}

export interface FetchOptions {
  /** ISR revalidation in seconds. 0 = no-store. Default: 60. */
  revalidate?: number | false
  /**
   * When true, non-2xx responses are still parsed as JSON and returned.
   * Use for endpoints like /healthz where a 503 body is valid data (degraded report).
   */
  allowNonOk?: boolean
}

export async function fetchFromWorker<T>(path: string, opts: FetchOptions = {}): Promise<T | null> {
  const workerUrl = serverWorkerUrl()
  const revalidate = opts.revalidate ?? 60
  const cacheConfig: RequestInit['next'] = revalidate === false ? { revalidate: 0 } : { revalidate }

  try {
    if (!workerUrl) throw new Error('NEXT_PUBLIC_WORKER_URL not set')
    const res = await fetch(`${workerUrl}${path}`, { next: cacheConfig })
    if (res.status === 404) return null
    if (!res.ok && !opts.allowNonOk) throw new Error(`${res.status} ${res.statusText}`)
    return (await res.json()) as T
  } catch {
    return null
  }
}
