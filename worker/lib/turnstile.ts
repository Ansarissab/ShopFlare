const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

let _warnedOnce = false

/**
 * verifyTurnstile — server-side Cloudflare Turnstile token verification.
 *
 * - Returns `true` immediately when `secret` is empty (dev bypass; warns once).
 * - Returns `false` when `token` is falsy.
 * - POSTs to the Turnstile siteverify endpoint and returns `response.success`.
 * - Returns `false` on any network/parse error (fail-closed).
 */
export async function verifyTurnstile(
  token: string | null | undefined,
  secret: string,
  remoteIp?: string,
): Promise<boolean> {
  // Dev bypass — no secret configured
  if (!secret) {
    if (!_warnedOnce) {
      console.warn('[turnstile] TURNSTILE_SECRET_KEY is not configured — skipping verification (dev mode)')
      _warnedOnce = true
    }
    return true
  }

  // No token submitted → reject
  if (!token) return false

  try {
    const body = new URLSearchParams({ secret, response: token })
    if (remoteIp) body.set('remoteip', remoteIp)

    const res = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    const data = (await res.json()) as { success: boolean }
    return data.success === true
  } catch {
    return false
  }
}
