// Cloudflare Access JWT verification — defense-in-depth for the admin API.
//
// Edge CF Access protects the admin paths at the network layer and injects a
// signed assertion JWT on every request that passes its policy. This middleware
// re-verifies that assertion inside the Worker so the admin endpoints are still
// protected even if someone reaches the Worker origin directly (bypassing the
// edge app, e.g. via the raw *.workers.dev hostname).
//
// Core verification logic lives in worker/lib/access-core.ts — also imported
// by src/middleware.ts so the Next.js admin UI is gated with the same impl.
//
// Config (worker/types.ts Bindings):
//   CF_ACCESS_TEAM_DOMAIN  e.g. "myteam.cloudflareaccess.com" (no scheme)
//   CF_ACCESS_AUD          the Access application's Audience (AUD) tag
//
// Fail-closed: in production a missing/invalid token → 403. In local
// `wrangler dev` with ENVIRONMENT=development AND ADMIN_DEV_BYPASS=1, requests
// are allowed through. Both flags are required — the bypass can never be
// accidental in production (ENVIRONMENT is forced to "production" by the deploy
// script and ADMIN_DEV_BYPASS is never set there).

import type { MiddlewareHandler } from 'hono'
import type { Bindings } from 'worker/types'
import { fetchJwks, verifyAccessJwt } from 'worker/lib/access-core'
import type { Jwk, VerifyResult } from 'worker/lib/access-core'

export type AccessVariables = { accessEmail: string }
export type AdminEnv = { Bindings: Bindings; Variables: AccessVariables }

const JWKS_KV_KEY = 'access:jwks'
const JWKS_TTL_SECONDS = 3600

async function getCachedJwks(env: Bindings, teamDomain: string): Promise<Jwk[]> {
  const cached = await env.KV.get<Jwk[]>(JWKS_KV_KEY, 'json')
  if (cached && cached.length > 0) return cached

  const keys = await fetchJwks(teamDomain)
  if (keys.length > 0) {
    await env.KV.put(JWKS_KV_KEY, JSON.stringify(keys), { expirationTtl: JWKS_TTL_SECONDS })
  }
  return keys
}

/**
 * Reads the Access assertion from the `Cf-Access-Jwt-Assertion` header (set by
 * the edge) or the `CF_Authorization` cookie, then verifies it. On success the
 * authenticated email is stashed at c.set('accessEmail', ...).
 */
export const requireAccess: MiddlewareHandler<AdminEnv> = async (c, next) => {
  const teamDomain = c.env.CF_ACCESS_TEAM_DOMAIN
  const aud = c.env.CF_ACCESS_AUD

  if (!teamDomain || !aud) {
    // Require BOTH flags — can never be accidental.
    if (c.env.ENVIRONMENT === 'development' && c.env.ADMIN_DEV_BYPASS === '1') {
      console.warn('[access] INSECURE: admin auth bypassed — ENVIRONMENT=development + ADMIN_DEV_BYPASS=1')
      return next()
    }
    return c.json({ error: 'Admin access is not configured' }, 403)
  }

  const headerToken = c.req.header('Cf-Access-Jwt-Assertion')
  const cookieToken = c.req
    .header('Cookie')
    ?.split(';')
    .map((p) => p.trim())
    .find((p) => p.startsWith('CF_Authorization='))
    ?.slice('CF_Authorization='.length)

  const token = headerToken ?? cookieToken
  if (!token) return c.json({ error: 'Unauthorized' }, 401)

  let result: VerifyResult
  try {
    const jwks = await getCachedJwks(c.env, teamDomain)
    result = await verifyAccessJwt(token, jwks, teamDomain, aud)
  } catch {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  if (!result.ok) return c.json({ error: 'Unauthorized' }, 401)

  c.set('accessEmail', result.email ?? '')
  return next()
}
