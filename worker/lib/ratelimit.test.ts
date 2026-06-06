import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { rateLimit } from 'worker/lib/ratelimit'
import type { Bindings } from 'worker/types'

afterEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
})

function makeEnv(getImpl: () => Promise<string | null>) {
  const get = vi.fn(getImpl)
  const put = vi.fn().mockResolvedValue(undefined)
  const env = { KV: { get, put } } as unknown as Bindings
  return { env, get, put }
}

const opts = { limit: 3, windowSeconds: 60 }

describe('rateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-06T00:00:00Z'))
  })

  it('allows and writes count=1 on a fresh key', async () => {
    const { env, get, put } = makeEnv(() => Promise.resolve(null))
    const allowed = await rateLimit(env, 'coupon', '1.2.3.4', opts)

    expect(allowed).toBe(true)
    expect(get).toHaveBeenCalledWith('rl:coupon:1.2.3.4')
    const [, value, putOpts] = put.mock.calls[0] as [string, string, { expirationTtl: number }]
    expect(value.startsWith('1:')).toBe(true)
    expect(putOpts.expirationTtl).toBeGreaterThanOrEqual(60)
  })

  it('uses "unknown" when ip is null/undefined', async () => {
    const { env, get } = makeEnv(() => Promise.resolve(null))
    await rateLimit(env, 'review', null, opts)
    expect(get).toHaveBeenCalledWith('rl:review:unknown')
    await rateLimit(env, 'review', undefined, opts)
    expect(get).toHaveBeenLastCalledWith('rl:review:unknown')
  })

  it('reuses an unexpired window and increments the count', async () => {
    const now = Math.floor(Date.now() / 1000)
    const expiresAt = now + 30
    const { env, put } = makeEnv(() => Promise.resolve(`1:${expiresAt}`))
    const allowed = await rateLimit(env, 'coupon', 'ip', opts)

    expect(allowed).toBe(true)
    const [, value] = put.mock.calls[0] as [string, string, unknown]
    expect(value).toBe(`2:${expiresAt}`)
  })

  it('blocks once the count reaches the limit', async () => {
    const now = Math.floor(Date.now() / 1000)
    const { env, put } = makeEnv(() => Promise.resolve(`3:${now + 30}`))
    const allowed = await rateLimit(env, 'coupon', 'ip', opts)

    expect(allowed).toBe(false)
    expect(put).not.toHaveBeenCalled()
  })

  it('starts a new window when the stored one has logically expired', async () => {
    const now = Math.floor(Date.now() / 1000)
    // e is in the past → ignored, count resets to 0 then becomes 1.
    const { env, put } = makeEnv(() => Promise.resolve(`9:${now - 100}`))
    const allowed = await rateLimit(env, 'coupon', 'ip', opts)

    expect(allowed).toBe(true)
    const [, value] = put.mock.calls[0] as [string, string, unknown]
    expect(value).toBe(`1:${now + 60}`)
  })

  it('treats a malformed stored value as a fresh window', async () => {
    const { env, put } = makeEnv(() => Promise.resolve('garbage'))
    const allowed = await rateLimit(env, 'coupon', 'ip', opts)
    expect(allowed).toBe(true)
    const [, value] = put.mock.calls[0] as [string, string, unknown]
    expect(value.startsWith('1:')).toBe(true)
  })

  it('handles NaN count with a finite expiry (count coerced to 0)', async () => {
    const now = Math.floor(Date.now() / 1000)
    const { env, put } = makeEnv(() => Promise.resolve(`x:${now + 30}`))
    const allowed = await rateLimit(env, 'coupon', 'ip', opts)
    expect(allowed).toBe(true)
    const [, value] = put.mock.calls[0] as [string, string, unknown]
    expect(value).toBe(`1:${now + 30}`)
  })

  it('floors the window to KV minimum of 60s', async () => {
    const { env, put } = makeEnv(() => Promise.resolve(null))
    await rateLimit(env, 'coupon', 'ip', { limit: 5, windowSeconds: 10 })
    const now = Math.floor(Date.now() / 1000)
    const [, value, putOpts] = put.mock.calls[0] as [string, string, { expirationTtl: number }]
    expect(value).toBe(`1:${now + 60}`)
    expect(putOpts.expirationTtl).toBe(60)
  })

  it('fails open (allows) when KV.get throws', async () => {
    const { env, put } = makeEnv(() => Promise.reject(new Error('KV down')))
    const allowed = await rateLimit(env, 'coupon', 'ip', opts)
    expect(allowed).toBe(true)
    expect(put).not.toHaveBeenCalled()
  })

  it('fails open when KV.put throws', async () => {
    const get = vi.fn().mockResolvedValue(null)
    const put = vi.fn().mockRejectedValue(new Error('write fail'))
    const env = { KV: { get, put } } as unknown as Bindings
    const allowed = await rateLimit(env, 'coupon', 'ip', opts)
    expect(allowed).toBe(true)
  })
})
