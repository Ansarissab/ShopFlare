// Admin route protection — defense-in-depth on top of edge CF Access.
//
// CF Access is the primary gate (network layer). This middleware provides an
// app-level guard so the admin HTML never renders for unauthenticated users
// even if the CF Access policy is misconfigured or an alternative origin is
// reached directly.
//
// Uses the same RS256/JWKS verification logic as the CF Worker (via
// worker/lib/access-core), keeping a single verified implementation.
//
// Config (env vars, set in .env.local / CF Pages settings):
//   CF_ACCESS_TEAM_DOMAIN  e.g. "myteam.cloudflareaccess.com"
//   CF_ACCESS_AUD          Access application Audience tag
//
// Dev bypass: set ENVIRONMENT=development AND ADMIN_DEV_BYPASS=1 in .env.local.
// Both flags are required. Never set in production.

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { fetchJwks, verifyAccessJwt } from 'worker/lib/access-core'
import type { Jwk } from 'worker/lib/access-core'

// Module-level JWKS cache — survives across requests in the same edge instance.
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

export const config = {
  matcher: '/admin/:path*',
}

export async function middleware(req: NextRequest) {
  const teamDomain = process.env.CF_ACCESS_TEAM_DOMAIN
  const aud = process.env.CF_ACCESS_AUD

  if (!teamDomain || !aud) {
    if (process.env.ENVIRONMENT === 'development' && process.env.ADMIN_DEV_BYPASS === '1') {
      return NextResponse.next()
    }
    return NextResponse.redirect(new URL('/admin/unauthorized', req.url))
  }

  const headerToken = req.headers.get('Cf-Access-Jwt-Assertion')
  const cookieToken = req.cookies.get('CF_Authorization')?.value
  const token = headerToken ?? cookieToken

  if (!token) {
    return NextResponse.redirect(new URL('/admin/unauthorized', req.url))
  }

  try {
    const jwks = await getJwks(teamDomain)
    const result = await verifyAccessJwt(token, jwks, teamDomain, aud)
    if (!result.ok) {
      return NextResponse.redirect(new URL('/admin/unauthorized', req.url))
    }
  } catch {
    return NextResponse.redirect(new URL('/admin/unauthorized', req.url))
  }

  return NextResponse.next()
}
