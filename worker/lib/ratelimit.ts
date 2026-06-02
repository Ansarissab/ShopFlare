// Coarse per-IP rate limiter for public POST routes, backed by KV.
//
// Turnstile blocks bots but is NOT a throttle (a solved token can be replayed
// within its validity window). This adds a fixed-window counter per
// CF-Connecting-IP + route bucket to deter brute-force / enumeration (e.g.
// coupon-code guessing, review/notify spam).
//
// KV is eventually consistent (~writes propagate in seconds) and its minimum
// expirationTtl is 60s, so this is a deliberately coarse abuse throttle, not a
// precise quota. It FAILS OPEN: any KV error allows the request, so a degraded
// limiter never blocks legitimate checkout/review traffic.

import type { Bindings } from 'worker/types'

const KV_MIN_TTL = 60 // Cloudflare KV rejects expirationTtl < 60

export interface RateLimitOptions {
  /** Max requests permitted per window. */
  limit: number
  /** Window length in seconds (floored to KV's 60s minimum). */
  windowSeconds: number
}

/**
 * Returns true if the request is ALLOWED, false if the per-IP limit for this
 * bucket is exceeded. Stored value is `"<count>:<windowExpiryEpoch>"` so the
 * window is fixed (TTL refreshes don't slide it).
 */
export async function rateLimit(
  env: Bindings,
  bucket: string,
  ip: string | null | undefined,
  opts: RateLimitOptions,
): Promise<boolean> {
  const key = `rl:${bucket}:${ip || 'unknown'}`
  const window = Math.max(KV_MIN_TTL, opts.windowSeconds)
  const now = Math.floor(Date.now() / 1000)

  try {
    let count = 0
    let expiresAt = now + window

    const raw = await env.KV.get(key)
    if (raw) {
      const [c, e] = raw.split(':').map(Number)
      // Reuse the existing window only if it hasn't logically expired yet.
      if (Number.isFinite(e) && e > now) {
        count = Number.isFinite(c) ? c : 0
        expiresAt = e
      }
    }

    if (count >= opts.limit) return false

    // TTL floored at KV's 60s minimum; window logic is gated by expiresAt, not
    // the raw TTL, so a slightly longer key lifetime is harmless.
    const ttl = Math.max(KV_MIN_TTL, expiresAt - now)
    await env.KV.put(key, `${count + 1}:${expiresAt}`, { expirationTtl: ttl })
    return true
  } catch {
    return true // fail open — never block on a degraded limiter
  }
}
