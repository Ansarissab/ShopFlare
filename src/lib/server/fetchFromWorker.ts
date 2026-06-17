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

  // NOTE: do NOT use `fetch(url, { next: { revalidate } })` here. The frontend runs
  // on OpenNext/workerd with NO incremental cache configured (open-next.config.ts ships
  // the bare `defineCloudflareConfig()`, no KV/R2 cache binding), so Next's Data Cache
  // has no backing store and every data-cached fetch fails on the deployed worker —
  // which `catch` then swallowed, rendering not-found on every page. These store pages
  // are dynamic (no-store) anyway, so fetch directly. To re-enable ISR/data-cache later,
  // wire an incrementalCache (r2/kv) in open-next.config.ts, then restore the `next` opt.
  const init: RequestInit = { cache: 'no-store' }

  try {
    if (!workerUrl) throw new Error('NEXT_PUBLIC_WORKER_URL not set (prod build missing the URL)')
    const res = await fetch(`${workerUrl}${path}`, init)
    if (res.status === 404) return null
    if (!res.ok && !opts.allowNonOk) throw new Error(`${res.status} ${res.statusText}`)
    return (await res.json()) as T
  } catch (err) {
    // Never silently swallow — a failing server fetch is why pages 404. Make it visible
    // in `wrangler tail` so the next incident is diagnosable in seconds, not hours.
    console.error(`[fetchFromWorker] ${path} failed:`, err instanceof Error ? err.message : err)
    return null
  }
}
