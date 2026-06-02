const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

let _warnedOnce = false

/**
 * verifyTurnstile — server-side Cloudflare Turnstile token verification.
 *
 * - When `secret` is empty: bypasses ONLY in local development
 *   (opts.isDevelopment), otherwise FAILS CLOSED (returns false) so a
 *   production worker deployed without the secret rejects unverified requests.
 * - Returns `false` when `token` is falsy.
 * - POSTs to the Turnstile siteverify endpoint and returns `response.success`.
 * - Returns `false` on any network/parse error (fail-closed).
 */
export async function verifyTurnstile(
  token: string | null | undefined,
  secret: string,
  remoteIp?: string,
  opts?: { isDevelopment?: boolean },
): Promise<boolean> {
  // No secret configured.
  if (!secret) {
    if (opts?.isDevelopment) {
      if (!_warnedOnce) {
        console.warn('[turnstile] TURNSTILE_SECRET_KEY is not configured — skipping verification (dev mode)')
        _warnedOnce = true
      }
      return true
    }
    console.warn('[turnstile] TURNSTILE_SECRET_KEY unset in production — failing closed')
    return false
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
