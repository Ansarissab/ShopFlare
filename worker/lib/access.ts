// App-level admin authentication for the admin API (/api/admin/*).
//
// Replaces Cloudflare Access: on *.workers.dev, Access can only gate a whole
// worker (which would lock the public store), not a single /admin path. Instead
// the merchant logs in via POST /api/admin/login with ADMIN_PASSWORD and the
// worker issues an HMAC session token (see admin-session.ts). That token is sent
// as an `Authorization: Bearer <token>` header on every admin request — cookies
// can't be shared across the separate frontend/API workers.dev hosts because
// workers.dev is on the Public Suffix List. This middleware verifies the token.
//
// Dev/test bypass: ENVIRONMENT=development AND ADMIN_DEV_BYPASS=1 (both required)
// skips verification — used by `wrangler dev` and the integration suite. Never
// set in production (the deploy forces ENVIRONMENT=production).

import type { MiddlewareHandler } from 'hono'
import type { Bindings } from 'worker/types'
import { verifySessionToken } from 'worker/lib/admin-session'

// Hono environment for admin routes. Kept here so every admin route file can
// import the type from one place (`worker/lib/access`).
export type AdminEnv = { Bindings: Bindings }

/**
 * Gate admin endpoints on a valid Bearer session token. Fails closed: missing
 * secret → 503, missing/invalid/expired token → 401.
 */
export const requireAdmin: MiddlewareHandler<AdminEnv> = async (c, next) => {
  // Local dev / integration tests — both flags required, never set in prod.
  if (c.env.ENVIRONMENT === 'development' && c.env.ADMIN_DEV_BYPASS === '1') {
    return next()
  }

  const secret = c.env.ADMIN_SESSION_SECRET
  if (!secret) {
    console.warn('[admin-auth] ADMIN_SESSION_SECRET unset — failing closed')
    return c.json({ error: 'Admin auth is not configured' }, 503)
  }

  const auth = c.req.header('Authorization')
  const token = auth?.startsWith('Bearer ') ? auth.slice('Bearer '.length) : undefined
  if (!token) return c.json({ error: 'Unauthorized' }, 401)

  const ok = await verifySessionToken(token, secret, Math.floor(Date.now() / 1000))
  if (!ok) return c.json({ error: 'Unauthorized' }, 401)

  return next()
}
