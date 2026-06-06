// Version-scoped edge cache for public GETs (Cloudflare Cache API).
//
// The cache key embeds the response ETag, which already folds in the global data
// version (see worker/lib/version.ts + fingerprint.ts). Any admin write bumps
// the version → new ETag → brand-new key. Old entries become unreachable and
// expire by TTL on their own — no explicit purge, and entries are never stale
// (immutable by construction). The per-colo nature of caches.default is
// irrelevant here: correctness comes from the key, not from purging.
//
// On a hit, the expensive build() (multi-query assembly) is skipped entirely.
// The caller computes the cheap ETag up front so conditional requests
// (If-None-Match → 304) short-circuit before any cache or build work.

import type { Context } from 'hono'

export async function edgeCached<T>(
  c: Context,
  opts: { etag: string; cacheControl: string; build: () => Promise<T> },
): Promise<Response> {
  const { etag, cacheControl, build } = opts

  if (c.req.header('If-None-Match') === etag) {
    return c.newResponse(null, 304, { 'Cache-Control': cacheControl, 'ETag': etag })
  }

  const cache: Cache | undefined = typeof caches !== 'undefined' ? caches.default : undefined
  const url = new URL(c.req.url)
  const key = new Request(`${url.origin}${url.pathname}?_etag=${encodeURIComponent(etag)}`)

  if (cache) {
    const hit = await cache.match(key)
    if (hit) return hit
  }

  const body = await build()
  const res = c.json(body, 200, { 'Cache-Control': cacheControl, 'ETag': etag })

  if (cache) {
    try {
      c.executionCtx.waitUntil(cache.put(key, res.clone()))
    } catch {
      // No execution context (e.g. unit tests) — skip background caching.
    }
  }
  return res
}
