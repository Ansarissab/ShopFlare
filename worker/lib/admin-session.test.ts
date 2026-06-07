import { describe, it, expect } from 'vitest'
import {
  createSessionToken,
  verifySessionToken,
  timingSafeEqual,
  timingSafeEqualStr,
  safePasswordEqual,
} from 'worker/lib/admin-session'

const SECRET = 'test-session-secret-please-change'
const NOW = 1_700_000_000 // fixed epoch seconds for determinism

describe('admin-session token', () => {
  it('round-trips a freshly signed token', async () => {
    const token = await createSessionToken(SECRET, 3600, NOW)
    expect(await verifySessionToken(token, SECRET, NOW)).toBe(true)
    // still valid just before expiry
    expect(await verifySessionToken(token, SECRET, NOW + 3599)).toBe(true)
  })

  it('rejects an expired token', async () => {
    const token = await createSessionToken(SECRET, 3600, NOW)
    expect(await verifySessionToken(token, SECRET, NOW + 3601)).toBe(false)
  })

  it('rejects a token signed with a different secret', async () => {
    const token = await createSessionToken(SECRET, 3600, NOW)
    expect(await verifySessionToken(token, 'other-secret', NOW)).toBe(false)
  })

  it('rejects a tampered payload', async () => {
    const token = await createSessionToken(SECRET, 3600, NOW)
    const [, sig] = token.split('.')
    // forge a far-future expiry, keep the original signature
    const forgedPayload = btoa(JSON.stringify({ exp: NOW + 10 ** 9 }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    expect(await verifySessionToken(`${forgedPayload}.${sig}`, SECRET, NOW)).toBe(false)
  })

  it('rejects a tampered signature', async () => {
    const token = await createSessionToken(SECRET, 3600, NOW)
    const [payload] = token.split('.')
    expect(await verifySessionToken(`${payload}.AAAA`, SECRET, NOW)).toBe(false)
  })

  it('rejects malformed tokens', async () => {
    expect(await verifySessionToken('', SECRET, NOW)).toBe(false)
    expect(await verifySessionToken('nodot', SECRET, NOW)).toBe(false)
    expect(await verifySessionToken('a.b.c', SECRET, NOW)).toBe(false)
    expect(await verifySessionToken('.', SECRET, NOW)).toBe(false)
  })
})

describe('timing-safe comparison', () => {
  it('matches equal byte arrays and strings', () => {
    expect(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true)
    expect(timingSafeEqualStr('hunter2', 'hunter2')).toBe(true)
  })

  it('rejects differing length or content', () => {
    expect(timingSafeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3]))).toBe(false)
    expect(timingSafeEqualStr('hunter2', 'hunter3')).toBe(false)
    expect(timingSafeEqualStr('short', 'longer-string')).toBe(false)
  })
})

describe('safePasswordEqual', () => {
  it('matches the correct password', async () => {
    expect(await safePasswordEqual(SECRET, 'correct horse', 'correct horse')).toBe(true)
  })

  it('rejects a wrong password (incl. different length)', async () => {
    expect(await safePasswordEqual(SECRET, 'wrong', 'correct horse')).toBe(false)
    expect(await safePasswordEqual(SECRET, 'correct hors', 'correct horse')).toBe(false)
    expect(await safePasswordEqual(SECRET, '', 'correct horse')).toBe(false)
  })
})
