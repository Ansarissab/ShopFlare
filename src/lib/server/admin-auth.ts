// Server-side admin authorization guard (defense-in-depth on top of edge CF Access).
//
// CF Access is the primary gate (network layer). This guard provides an
// app-level check so admin pages never render for unauthenticated users even if
// the CF Access policy is misconfigured or an alternative origin is reached.
//
// Replaces the former `src/proxy.ts` middleware: Next.js 16 forces proxy onto
// the Node.js runtime, which the OpenNext Cloudflare adapter cannot run. Running
// the same verification in the admin route-group layout (a server component) is
// also Next.js's own recommended pattern — enforce auth in route logic, not
// solely in middleware. Uses the same RS256/JWKS logic as the CF Worker
// (worker/lib/access-core), keeping a single verified implementation.
//
// Config (env vars, set in .env.local / CF frontend worker vars):
//   CF_ACCESS_TEAM_DOMAIN  e.g. "myteam.cloudflareaccess.com"
//   CF_ACCESS_AUD          Access application Audience tag
//
// Dev bypass: set ENVIRONMENT=development AND ADMIN_DEV_BYPASS=1 in .env.local.
// Both flags are required. Never set in production.

import 'server-only'
import { cookies, headers } from 'next/headers'
import { fetchJwks, verifyAccessJwt } from 'worker/lib/access-core'
import type { Jwk } from 'worker/lib/access-core'

// Module-level JWKS cache — survives across requests in the same worker instance.
const jwksCache: { keys: Jwk[]; fetchedAt: number } = { keys: [], fetchedAt: 0 }
const JWKS_TTL_MS = 60 * 60 * 1000

async function getJwks(teamDomain: string): Promise<Jwk[]> {
  const now = Date.now()
  if (jwksCache.keys.length > 0 && now - jwksCache.fetchedAt < JWKS_TTL_MS) {
    return jwksCache.keys
  }
  const keys = await fetchJwks(teamDomain)
  if (keys.length > 0) {
    jwksCache.keys = keys
    jwksCache.fetchedAt = now
  }
  return keys
}

export async function isAdminAuthorized(): Promise<boolean> {
  try {
    const teamDomain = process.env.CF_ACCESS_TEAM_DOMAIN
    const aud = process.env.CF_ACCESS_AUD

    if (!teamDomain || !aud) {
      return process.env.ENVIRONMENT === 'development' && process.env.ADMIN_DEV_BYPASS === '1'
    }

    const [hdrs, cookieStore] = await Promise.all([headers(), cookies()])
    const token = hdrs.get('Cf-Access-Jwt-Assertion') ?? cookieStore.get('CF_Authorization')?.value
    if (!token) return false

    const jwks = await getJwks(teamDomain)
    const result = await verifyAccessJwt(token, jwks, teamDomain, aud)
    return result.ok
  } catch (err) {
    // Fail closed: any error in the auth path → treat as unauthorized.
    console.error('[admin-auth] authorization check failed:', err instanceof Error ? (err.stack ?? err.message) : String(err))
    return false
  }
}
