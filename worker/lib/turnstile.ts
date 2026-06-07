const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/**
 * verifyTurnstile — server-side Cloudflare Turnstile token verification.
 *
 * - Local/dev (`opts.isDevelopment`): Turnstile is NOT used — verification is
 *   skipped entirely, so local `wrangler dev` and the integration suite never
 *   need a real token or secret (and a real key in `.dev.vars` can't 403 them).
 *   Production sets ENVIRONMENT=production, so this never bypasses in prod.
 * - Production with no `secret`: FAILS CLOSED (returns false).
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
  // Local/dev: skip Turnstile entirely (not used locally).
  if (opts?.isDevelopment) return true

  // Production. No secret configured → fail closed.
  if (!secret) {
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
