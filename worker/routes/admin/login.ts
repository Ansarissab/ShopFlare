// POST /api/admin/login — exchange the admin password for a session token.
//
// Public (no Bearer required) but Turnstile-protected, like every other public
// form. On success returns an HMAC session token the client stores and sends as
// `Authorization: Bearer <token>` on subsequent /api/admin/* requests.
//
// Password lives in the ADMIN_PASSWORD secret — rotate any time with
// `wrangler secret put ADMIN_PASSWORD` (no redeploy; read fresh per request).

import { Hono } from 'hono'
import type { AdminEnv } from 'worker/lib/access'
import { verifyTurnstile } from 'worker/lib/turnstile'
import { rateLimit } from 'worker/lib/ratelimit'
import { createSessionToken, safePasswordEqual } from 'worker/lib/admin-session'

// 7 days — long enough to avoid nagging a single merchant, short enough to bound
// a leaked token. Rotate ADMIN_SESSION_SECRET to revoke all tokens immediately.
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60

// Brute-force throttle: max 5 attempts per IP per 5 minutes. Turnstile blocks
// bots but a solved token can be replayed within its window; this caps password
// guessing regardless.
const LOGIN_MAX_ATTEMPTS = 5
const LOGIN_WINDOW_SECONDS = 300

const app = new Hono<AdminEnv>()

app.post('/', async (c) => {
  const isDev = c.env.ENVIRONMENT === 'development'
  const ip = c.req.header('CF-Connecting-IP')

  // 1. Per-IP throttle, before any crypto work.
  const allowed = await rateLimit(c.env, 'admin-login', ip, {
    limit: LOGIN_MAX_ATTEMPTS,
    windowSeconds: LOGIN_WINDOW_SECONDS,
  })
  if (!allowed) return c.json({ error: 'Too many attempts. Try again later.' }, 429)

  let body: { password?: string; turnstileToken?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid request' }, 400)
  }

  // 2. Turnstile gate (bot protection on this public form).
  const turnstileOk = await verifyTurnstile(
    body.turnstileToken,
    c.env.TURNSTILE_SECRET_KEY,
    ip ?? undefined,
    { isDevelopment: isDev },
  )
  if (!turnstileOk) return c.json({ error: 'Verification failed' }, 403)

  const adminPassword = c.env.ADMIN_PASSWORD
  const secret = c.env.ADMIN_SESSION_SECRET
  if (!adminPassword || !secret) {
    console.warn('[admin-login] ADMIN_PASSWORD / ADMIN_SESSION_SECRET unset — cannot authenticate')
    return c.json({ error: 'Admin auth is not configured' }, 503)
  }

  // 3. Constant-time, length-blind password check.
  if (!body.password || !(await safePasswordEqual(secret, body.password, adminPassword))) {
    return c.json({ error: 'Invalid password' }, 401)
  }

  const token = await createSessionToken(secret, SESSION_TTL_SECONDS, Math.floor(Date.now() / 1000))
  return c.json({ token, expiresIn: SESSION_TTL_SECONDS })
})

export default app
