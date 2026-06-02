// Shared CF Access JWT verification — no Hono or CF-Worker-specific deps.
// Imported by worker/lib/access.ts (with KV cache) and src/middleware.ts
// (with module-level in-memory cache). All APIs are standard Web Crypto /
// Fetch — compatible with both the CF Worker and Next.js Edge runtimes.

export interface Jwk {
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

export interface VerifyResult {
  ok: boolean
  email?: string
}

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

export async function fetchJwks(teamDomain: string): Promise<Jwk[]> {
  const res = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`)
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`)
  const body = (await res.json()) as { keys?: Jwk[] }
  return body.keys ?? []
}

export async function verifyAccessJwt(
  token: string,
  jwks: Jwk[],
  teamDomain: string,
  expectedAud: string,
): Promise<VerifyResult> {
  const parts = token.split('.')
  if (parts.length !== 3) return { ok: false }

  const [headerB64, payloadB64, signatureB64] = parts
  const header = base64UrlToJson<{ kid?: string; alg?: string }>(headerB64)
  const payload = base64UrlToJson<AccessPayload>(payloadB64)
  if (!header?.kid || header.alg !== 'RS256' || !payload) return { ok: false }

  const now = Math.floor(Date.now() / 1000)
  if (payload.exp !== undefined && payload.exp < now) return { ok: false }
  if (payload.nbf !== undefined && payload.nbf > now) return { ok: false }
  if (payload.iss !== `https://${teamDomain}`) return { ok: false }
  const auds = Array.isArray(payload.aud) ? payload.aud : payload.aud ? [payload.aud] : []
  if (!auds.includes(expectedAud)) return { ok: false }

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
