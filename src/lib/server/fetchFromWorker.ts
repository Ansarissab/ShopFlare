// Typed server-side GET helper — wraps fetch() with worker base URL + cache control.
// Use only in async server components and generateMetadata functions (never in
// 'use client' code — for client fetches use lib/api.ts).

import { serverWorkerUrl } from '@/lib/server/worker-origin'

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
