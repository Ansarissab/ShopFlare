// Typed server-side GET helper — wraps fetch() with worker base URL + cache control.
// Use only in async server components and generateMetadata functions (never in
// 'use client' code — for client fetches use lib/api.ts).

import { getCloudflareContext } from '@opennextjs/cloudflare'
import { serverWorkerUrl } from '@/lib/server/worker-origin'

/** Convert an R2 key to its public CDN URL (server-side only). */
export function r2Url(key: string | null | undefined): string | null {
  if (!key) return null
  return `${serverWorkerUrl()}/cdn/${key}`
}

/** Minimal shape of a Cloudflare service-binding Fetcher. */
type Fetcher = { fetch: (input: string | URL | Request, init?: RequestInit) => Promise<Response> }

/**
 * The API worker's service binding (env.API), when running on workerd with the binding
 * configured in wrangler.frontend.jsonc. An internal worker→worker call — no public
 * round-trip — so it's much faster than the public fetch and cuts SSR TTFB (the dominant
 * LCP factor). Returns undefined during `next dev` and build-time static generation (no
 * Cloudflare request context); callers fall back to the public fetch.
 */
function apiBinding(): Fetcher | undefined {
  try {
    return (getCloudflareContext().env as { API?: Fetcher }).API
  } catch {
    return undefined
  }
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
    const url = `${workerUrl}${path}`

    // Fast path: internal service binding (no public round-trip). Fall back to the public
    // fetch (cache:'no-store') when the binding is absent (next dev / build static-gen) or
    // unavailable (preview without the API worker running). The no-store public fetch is
    // also what lets Next detect dynamic rendering at build time.
    const binding = apiBinding()
    let res: Response
    if (binding) {
      try {
        res = await binding.fetch(url)
        // A binding that's present but unavailable (e.g. local preview without the API
        // worker running) surfaces as a 5xx, not a throw — fall back to the public fetch.
        // Only on 5xx (not legit 4xx, and never for allowNonOk where a non-ok body is data).
        if (res.status >= 500 && !opts.allowNonOk) res = await fetch(url, init)
      } catch {
        res = await fetch(url, init)
      }
    } else {
      res = await fetch(url, init)
    }

    if (res.status === 404) return null
    if (!res.ok && !opts.allowNonOk) throw new Error(`${res.status} ${res.statusText}`)
    return (await res.json()) as T
  } catch (err) {
    // Re-throw Next's control-flow signals — NEVER swallow them. A `cache: 'no-store'`
    // fetch during static generation throws DYNAMIC_SERVER_USAGE to tell Next "render
    // this route dynamically"; swallowing it makes Next statically render the route with
    // null data instead (e.g. /checkout/success built with a null store config). Same for
    // NEXT_REDIRECT / NEXT_NOT_FOUND. These are identified by a string `digest`.
    if (
      err &&
      typeof err === 'object' &&
      typeof (err as { digest?: unknown }).digest === 'string' &&
      ((err as { digest: string }).digest.startsWith('DYNAMIC_SERVER_USAGE') ||
        (err as { digest: string }).digest.startsWith('NEXT_'))
    ) {
      throw err
    }
    // Genuine fetch failure — log (never silent; a failing server fetch is why pages 404,
    // visible in `wrangler tail`) and degrade to null.
    console.error(`[fetchFromWorker] ${path} failed:`, err instanceof Error ? err.message : err)
    return null
  }
}
