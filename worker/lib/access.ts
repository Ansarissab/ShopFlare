// Cloudflare Access JWT verification — defense-in-depth for the admin API.
//
// Edge CF Access protects the admin paths at the network layer and injects a
// signed assertion JWT on every request that passes its policy. This middleware
// re-verifies that assertion inside the Worker so the admin endpoints are still
// protected even if someone reaches the Worker origin directly (bypassing the
// edge app, e.g. via the raw *.workers.dev hostname).
//
// No external JWT library — RS256 verification runs on the Workers-native
// WebCrypto API. The Access signing keys (JWKS) are fetched from the team's
// certs endpoint and cached in KV.
//
// Config (worker/types.ts Bindings):
//   CF_ACCESS_TEAM_DOMAIN  e.g. "myteam.cloudflareaccess.com" (no scheme)
//   CF_ACCESS_AUD          the Access application's Audience (AUD) tag
//
// Fail-closed: in production a missing/invalid token → 403. In local
// `wrangler dev` (ENVIRONMENT=development) with Access unconfigured, requests
// are allowed through so the admin UI is usable without a tunnel.

import type { MiddlewareHandler } from 'hono'
import type { Bindings } from 'worker/types'

// Hono context variables set by requireAccess — admin routers use this env shape.
export type AccessVariables = { accessEmail: string }
export type AdminEnv = { Bindings: Bindings; Variables: AccessVariables }

const JWKS_KV_KEY = 'access:jwks'
const JWKS_TTL_SECONDS = 3600 // 1h — Access rotates keys roughly every 6 weeks

interface Jwk {
  kid: string
  kty: string
  alg?: string
  use?: string
  n: string
  e: string
}

interface AccessPayload {
  aud?: string | string[]
  iss?: string
  exp?: number
  nbf?: number
  iat?: number
  email?: string
  sub?: string
}

// ─── base64url helpers ─────────────────────────────────────────────────────────

function base64UrlToBytes(input: string): Uint8Array {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  const bin = atob(padded)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function base64UrlToJson<T>(input: string): T | null {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlToBytes(input))) as T
  } catch {
    return null
  }
}

// ─── JWKS fetch + cache ─────────────────────────────────────────────────────────

async function getJwks(env: Bindings, teamDomain: string): Promise<Jwk[]> {
  const cached = await env.KV.get<Jwk[]>(JWKS_KV_KEY, 'json')
  if (cached && cached.length > 0) return cached

  const res = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`)
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`)

  const body = (await res.json()) as { keys?: Jwk[] }
  const keys = body.keys ?? []
  if (keys.length > 0) {
    await env.KV.put(JWKS_KV_KEY, JSON.stringify(keys), { expirationTtl: JWKS_TTL_SECONDS })
  }
  return keys
}

// ─── token verification ─────────────────────────────────────────────────────────

interface VerifyResult {
  ok: boolean
  email?: string
}

async function verifyAccessJwt(
  token: string,
  env: Bindings,
  teamDomain: string,
  expectedAud: string,
): Promise<VerifyResult> {
  const parts = token.split('.')
  if (parts.length !== 3) return { ok: false }

  const [headerB64, payloadB64, signatureB64] = parts
  const header = base64UrlToJson<{ kid?: string; alg?: string }>(headerB64)
  const payload = base64UrlToJson<AccessPayload>(payloadB64)
  if (!header?.kid || header.alg !== 'RS256' || !payload) return { ok: false }

  // Claim checks (cheap — do before crypto).
  const now = Math.floor(Date.now() / 1000)
  if (payload.exp !== undefined && payload.exp < now) return { ok: false }
  if (payload.nbf !== undefined && payload.nbf > now) return { ok: false }
  if (payload.iss !== `https://${teamDomain}`) return { ok: false }
  const auds = Array.isArray(payload.aud) ? payload.aud : payload.aud ? [payload.aud] : []
  if (!auds.includes(expectedAud)) return { ok: false }

  // Signature check against the matching JWKS key.
  const jwks = await getJwks(env, teamDomain)
  const jwk = jwks.find((k) => k.kid === header.kid)
  if (!jwk) return { ok: false }

  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  )

  const verified = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    base64UrlToBytes(signatureB64),
    new TextEncoder().encode(`${headerB64}.${payloadB64}`),
  )

  return verified ? { ok: true, email: payload.email } : { ok: false }
}

// ─── Hono middleware ─────────────────────────────────────────────────────────────

/**
 * Reads the Access assertion from the `Cf-Access-Jwt-Assertion` header (set by
 * the edge) or the `CF_Authorization` cookie, then verifies it. On success the
 * authenticated email is stashed at c.set('accessEmail', ...).
 */
export const requireAccess: MiddlewareHandler<AdminEnv> = async (c, next) => {
  const teamDomain = c.env.CF_ACCESS_TEAM_DOMAIN
  const aud = c.env.CF_ACCESS_AUD

  // Local dev convenience: if Access is unconfigured and we're in development,
  // skip verification so the admin UI works without a Cloudflare tunnel.
  // Deployed workers run with ENVIRONMENT=production (forced by the
  // `worker:deploy` script's --var override), so this branch CANNOT open the
  // admin API in production even if the Access vars are forgotten.
  if (!teamDomain || !aud) {
    if (c.env.ENVIRONMENT === 'development') {
      console.warn('[access] INSECURE: admin auth bypassed — CF Access unconfigured + ENVIRONMENT=development')
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
    result = await verifyAccessJwt(token, c.env, teamDomain, aud)
  } catch {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  if (!result.ok) return c.json({ error: 'Unauthorized' }, 401)

  c.set('accessEmail', result.email ?? '')
  return next()
}
