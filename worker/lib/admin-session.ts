// Stateless HMAC-signed session tokens for app-level admin auth.
//
// Used in place of Cloudflare Access on *.workers.dev (where Access can't gate a
// single path). The merchant logs in with ADMIN_PASSWORD; the worker issues a
// token signed with ADMIN_SESSION_SECRET. The token is sent as a Bearer header
// on every /api/admin/* request (cookies can't be shared across the separate
// frontend/API workers.dev hosts — workers.dev is a public-suffix domain).
//
// Token format:  base64url(JSON {exp}) "." base64url(HMAC-SHA256(payload))
// Stateless: no DB lookup. Rotate ADMIN_SESSION_SECRET to invalidate all tokens.

function bytesToB64Url(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64UrlToBytes(input: string): Uint8Array {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  const bin = atob(padded)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

// Constant-time byte comparison — avoids leaking signature validity via timing.
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

// Constant-time string comparison (UTF-8 bytes).
export function timingSafeEqualStr(a: string, b: string): boolean {
  const enc = new TextEncoder()
  return timingSafeEqual(enc.encode(a), enc.encode(b))
}

/**
 * Constant-time password match that leaks neither timing nor length: both inputs
 * are HMAC'd to fixed-length 32-byte digests (keyed with `secret`) before
 * comparison, so a wrong-length password takes the same path as a wrong-value one.
 */
export async function safePasswordEqual(secret: string, a: string, b: string): Promise<boolean> {
  const [da, db] = await Promise.all([hmacSha256(secret, a), hmacSha256(secret, b)])
  return timingSafeEqual(da, db)
}

async function hmacSha256(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return new Uint8Array(sig)
}

/**
 * Sign a session token valid for `ttlSeconds` from `nowSeconds`.
 * Caller passes nowSeconds (Math.floor(Date.now() / 1000)) for testability.
 */
export async function createSessionToken(
  secret: string,
  ttlSeconds: number,
  nowSeconds: number,
): Promise<string> {
  const payloadB64 = bytesToB64Url(
    new TextEncoder().encode(JSON.stringify({ exp: nowSeconds + ttlSeconds })),
  )
  const sig = await hmacSha256(secret, payloadB64)
  return `${payloadB64}.${bytesToB64Url(sig)}`
}

/**
 * Verify signature + expiry. Returns true only when the HMAC matches and the
 * token has not expired. Any malformed input returns false (fail-closed).
 */
export async function verifySessionToken(
  token: string,
  secret: string,
  nowSeconds: number,
): Promise<boolean> {
  const parts = token.split('.')
  if (parts.length !== 2) return false
  const [payloadB64, sigB64] = parts
  if (!payloadB64 || !sigB64) return false

  let providedSig: Uint8Array
  try {
    providedSig = b64UrlToBytes(sigB64)
  } catch {
    return false
  }

  const expectedSig = await hmacSha256(secret, payloadB64)
  if (!timingSafeEqual(expectedSig, providedSig)) return false

  try {
    const payload = JSON.parse(new TextDecoder().decode(b64UrlToBytes(payloadB64))) as { exp?: number }
    return typeof payload.exp === 'number' && payload.exp > nowSeconds
  } catch {
    return false
  }
}
