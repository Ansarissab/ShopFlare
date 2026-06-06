import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { verifyTurnstile } from 'worker/lib/turnstile'

describe('verifyTurnstile', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ─── No secret configured ─────────────────────────────────────────────────

  it('bypasses verification in dev mode when secret is empty', async () => {
    const result = await verifyTurnstile('any-token', '', undefined, { isDevelopment: true })
    expect(result).toBe(true)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('fails closed in production when secret is empty', async () => {
    const result = await verifyTurnstile('any-token', '', undefined, { isDevelopment: false })
    expect(result).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('fails closed when secret is empty and no opts provided', async () => {
    const result = await verifyTurnstile('any-token', '')
    expect(result).toBe(false)
  })

  // ─── No token ─────────────────────────────────────────────────────────────

  it('returns false when token is null', async () => {
    const result = await verifyTurnstile(null, 'secret123')
    expect(result).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns false when token is undefined', async () => {
    const result = await verifyTurnstile(undefined, 'secret123')
    expect(result).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns false when token is empty string', async () => {
    const result = await verifyTurnstile('', 'secret123')
    expect(result).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })

  // ─── Successful verification ──────────────────────────────────────────────

  it('returns true when siteverify responds with success: true', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    )
    const result = await verifyTurnstile('valid-token', 'secret123')
    expect(result).toBe(true)
  })

  it('sends the token and secret to the siteverify endpoint', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    )
    await verifyTurnstile('my-token', 'my-secret')
    expect(fetch).toHaveBeenCalledWith(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('includes remoteip in POST body when provided', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    )
    await verifyTurnstile('my-token', 'my-secret', '1.2.3.4')
    const callArgs = vi.mocked(fetch).mock.calls[0]
    const body = (callArgs[1] as RequestInit).body as string
    expect(body).toContain('remoteip=1.2.3.4')
  })

  // ─── Failed verification ──────────────────────────────────────────────────

  it('returns false when siteverify responds with success: false', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false }), { status: 200 }),
    )
    const result = await verifyTurnstile('invalid-token', 'secret123')
    expect(result).toBe(false)
  })

  it('returns false on network error (fail-closed)', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))
    const result = await verifyTurnstile('my-token', 'secret123')
    expect(result).toBe(false)
  })

  it('returns false on JSON parse error (fail-closed)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('not-json', { status: 200 }),
    )
    const result = await verifyTurnstile('my-token', 'secret123')
    expect(result).toBe(false)
  })
})
