import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { fetchJwks, verifyAccessJwt, type Jwk } from 'worker/lib/access-core'

const TEAM = 'team.cloudflareaccess.com'
const AUD = 'aud-tag-123'
const ISS = `https://${TEAM}`

afterEach(() => {
  vi.restoreAllMocks()
})

// ─── helpers ────────────────────────────────────────────────────────────────

function b64url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function jsonToB64url(obj: unknown): string {
  return b64url(new TextEncoder().encode(JSON.stringify(obj)))
}

// One RSA keypair shared across the whole suite — generateKey is slow, so doing
// it per test would blow the default 5s timeout.
let sharedPrivateKey: CryptoKey
let sharedJwk: Jwk

beforeAll(async () => {
  const pair = (await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair
  const pub = (await crypto.subtle.exportKey('jwk', pair.publicKey)) as { n: string; e: string; kty: string }
  sharedPrivateKey = pair.privateKey
  sharedJwk = { kid: 'test-kid', kty: pub.kty, n: pub.n, e: pub.e, alg: 'RS256', use: 'sig' }
})

function makeKeyPair() {
  return { privateKey: sharedPrivateKey, jwk: sharedJwk, kid: sharedJwk.kid }
}

async function signToken(
  privateKey: CryptoKey,
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
): Promise<string> {
  const h = jsonToB64url(header)
  const p = jsonToB64url(payload)
  const data = new TextEncoder().encode(`${h}.${p}`)
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, data)
  return `${h}.${p}.${b64url(new Uint8Array(sig))}`
}

function validPayload(over: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000)
  return { iss: ISS, aud: AUD, exp: now + 3600, nbf: now - 10, email: 'admin@shop.test', ...over }
}

// ─── fetchJwks ──────────────────────────────────────────────────────────────

describe('fetchJwks', () => {
  it('returns the keys array from the certs endpoint', async () => {
    const keys: Jwk[] = [{ kid: 'k1', kty: 'RSA', n: 'n', e: 'AQAB' }]
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ keys }), { status: 200 }),
    )
    const out = await fetchJwks(TEAM)
    expect(out).toEqual(keys)
    expect(fetch).toHaveBeenCalledWith(`https://${TEAM}/cdn-cgi/access/certs`)
  })

  it('returns [] when the body has no keys field', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    )
    expect(await fetchJwks(TEAM)).toEqual([])
  })

  it('throws when the response is not ok', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 503 }))
    await expect(fetchJwks(TEAM)).rejects.toThrow('JWKS fetch failed: 503')
  })
})

// ─── verifyAccessJwt ─────────────────────────────────────────────────────────

describe('verifyAccessJwt', () => {
  it('verifies a well-formed, correctly-signed token', async () => {
    const { privateKey, jwk } = makeKeyPair()
    const token = await signToken(privateKey, { alg: 'RS256', kid: jwk.kid }, validPayload())
    const res = await verifyAccessJwt(token, [jwk], TEAM, AUD)
    expect(res).toEqual({ ok: true, email: 'admin@shop.test' })
  })

  it('accepts aud given as an array', async () => {
    const { privateKey, jwk } = makeKeyPair()
    const token = await signToken(privateKey, { alg: 'RS256', kid: jwk.kid }, validPayload({ aud: ['other', AUD] }))
    const res = await verifyAccessJwt(token, [jwk], TEAM, AUD)
    expect(res.ok).toBe(true)
  })

  it('accepts a token with no exp/nbf set', async () => {
    const { privateKey, jwk } = makeKeyPair()
    const payload = { iss: ISS, aud: AUD, email: 'a@b.c' }
    const token = await signToken(privateKey, { alg: 'RS256', kid: jwk.kid }, payload)
    const res = await verifyAccessJwt(token, [jwk], TEAM, AUD)
    expect(res.ok).toBe(true)
  })

  it('rejects a token that does not have 3 parts', async () => {
    expect(await verifyAccessJwt('a.b', [], TEAM, AUD)).toEqual({ ok: false })
  })

  it('rejects when the header is not valid base64 JSON', async () => {
    const token = `!!!.${jsonToB64url(validPayload())}.sig`
    expect(await verifyAccessJwt(token, [], TEAM, AUD)).toEqual({ ok: false })
  })

  it('rejects when alg is not RS256', async () => {
    const { privateKey, jwk } = makeKeyPair()
    const token = await signToken(privateKey, { alg: 'HS256', kid: jwk.kid }, validPayload())
    expect(await verifyAccessJwt(token, [jwk], TEAM, AUD)).toEqual({ ok: false })
  })

  it('rejects when kid is missing from the header', async () => {
    const { privateKey, jwk } = makeKeyPair()
    const token = await signToken(privateKey, { alg: 'RS256' }, validPayload())
    expect(await verifyAccessJwt(token, [jwk], TEAM, AUD)).toEqual({ ok: false })
  })

  it('rejects when the payload is not valid JSON', async () => {
    const { jwk } = makeKeyPair()
    const header = jsonToB64url({ alg: 'RS256', kid: jwk.kid })
    const token = `${header}.@@@bad@@@.sig`
    expect(await verifyAccessJwt(token, [jwk], TEAM, AUD)).toEqual({ ok: false })
  })

  it('rejects an expired token', async () => {
    const { privateKey, jwk } = makeKeyPair()
    const token = await signToken(privateKey, { alg: 'RS256', kid: jwk.kid }, validPayload({ exp: Math.floor(Date.now() / 1000) - 5 }))
    expect(await verifyAccessJwt(token, [jwk], TEAM, AUD)).toEqual({ ok: false })
  })

  it('rejects a not-yet-valid (nbf in future) token', async () => {
    const { privateKey, jwk } = makeKeyPair()
    const token = await signToken(privateKey, { alg: 'RS256', kid: jwk.kid }, validPayload({ nbf: Math.floor(Date.now() / 1000) + 1000 }))
    expect(await verifyAccessJwt(token, [jwk], TEAM, AUD)).toEqual({ ok: false })
  })

  it('rejects a wrong issuer', async () => {
    const { privateKey, jwk } = makeKeyPair()
    const token = await signToken(privateKey, { alg: 'RS256', kid: jwk.kid }, validPayload({ iss: 'https://evil.example' }))
    expect(await verifyAccessJwt(token, [jwk], TEAM, AUD)).toEqual({ ok: false })
  })

  it('rejects a wrong audience', async () => {
    const { privateKey, jwk } = makeKeyPair()
    const token = await signToken(privateKey, { alg: 'RS256', kid: jwk.kid }, validPayload({ aud: 'someone-else' }))
    expect(await verifyAccessJwt(token, [jwk], TEAM, AUD)).toEqual({ ok: false })
  })

  it('rejects when aud is entirely absent', async () => {
    const { privateKey, jwk } = makeKeyPair()
    const payload = { iss: ISS, exp: Math.floor(Date.now() / 1000) + 3600 }
    const token = await signToken(privateKey, { alg: 'RS256', kid: jwk.kid }, payload)
    expect(await verifyAccessJwt(token, [jwk], TEAM, AUD)).toEqual({ ok: false })
  })

  it('rejects when no JWK matches the header kid', async () => {
    const { privateKey, jwk } = makeKeyPair()
    const token = await signToken(privateKey, { alg: 'RS256', kid: 'unknown-kid' }, validPayload())
    expect(await verifyAccessJwt(token, [jwk], TEAM, AUD)).toEqual({ ok: false })
  })

  it('rejects when the signature does not verify (tampered payload)', async () => {
    const { privateKey, jwk } = makeKeyPair()
    const token = await signToken(privateKey, { alg: 'RS256', kid: jwk.kid }, validPayload())
    const [h, , s] = token.split('.')
    const tampered = `${h}.${jsonToB64url(validPayload({ email: 'attacker@evil.test' }))}.${s}`
    expect(await verifyAccessJwt(tampered, [jwk], TEAM, AUD)).toEqual({ ok: false })
  })
})
