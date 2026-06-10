import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { requireAdmin } from 'worker/lib/access'
import type { AdminEnv } from 'worker/lib/access'
import { createSessionToken } from 'worker/lib/admin-session'

// Build a tiny app gated by requireAdmin with a single protected route. Each
// request passes its own env bindings (Hono's 3rd app.request arg).
function makeApp() {
  const app = new Hono<AdminEnv>()
  app.use('*', requireAdmin)
  app.get('/protected', (c) => c.text('ok'))
  return app
}

const SECRET = 'unit-test-secret'
const now = () => Math.floor(Date.now() / 1000)

describe('requireAdmin', () => {
  it('allows the dev/test bypass (ENVIRONMENT=development + ADMIN_DEV_BYPASS=1)', async () => {
    const res = await makeApp().request(
      '/protected',
      {},
      { ENVIRONMENT: 'development', ADMIN_DEV_BYPASS: '1' },
    )
    expect(res.status).toBe(200)
  })

  it('does NOT bypass with only one flag', async () => {
    const a = await makeApp().request('/protected', {}, { ENVIRONMENT: 'development' })
    expect(a.status).toBe(503) // no secret configured → fail closed
    const b = await makeApp().request('/protected', {}, { ADMIN_DEV_BYPASS: '1' })
    expect(b.status).toBe(503)
  })

  it('fails closed (503) when ADMIN_SESSION_SECRET is unset in production', async () => {
    const res = await makeApp().request('/protected', {}, { ENVIRONMENT: 'production' })
    expect(res.status).toBe(503)
  })

  it('rejects a request with no Authorization header (401)', async () => {
    const res = await makeApp().request('/protected', {}, { ADMIN_SESSION_SECRET: SECRET })
    expect(res.status).toBe(401)
  })

  it('rejects a malformed / non-Bearer Authorization header (401)', async () => {
    const res = await makeApp().request(
      '/protected',
      { headers: { Authorization: 'Basic abc' } },
      { ADMIN_SESSION_SECRET: SECRET },
    )
    expect(res.status).toBe(401)
  })

  it('rejects an invalid token (401)', async () => {
    const res = await makeApp().request(
      '/protected',
      { headers: { Authorization: 'Bearer not.a.real.token' } },
      { ADMIN_SESSION_SECRET: SECRET },
    )
    expect(res.status).toBe(401)
  })

  it('rejects a token signed with a different secret (401)', async () => {
    const token = await createSessionToken('other-secret', 3600, now())
    const res = await makeApp().request(
      '/protected',
      { headers: { Authorization: `Bearer ${token}` } },
      { ADMIN_SESSION_SECRET: SECRET },
    )
    expect(res.status).toBe(401)
  })

  it('rejects an expired token (401)', async () => {
    const token = await createSessionToken(SECRET, -10, now()) // already expired
    const res = await makeApp().request(
      '/protected',
      { headers: { Authorization: `Bearer ${token}` } },
      { ADMIN_SESSION_SECRET: SECRET },
    )
    expect(res.status).toBe(401)
  })

  it('allows a valid, unexpired token (200)', async () => {
    const token = await createSessionToken(SECRET, 3600, now())
    const res = await makeApp().request(
      '/protected',
      { headers: { Authorization: `Bearer ${token}` } },
      { ADMIN_SESSION_SECRET: SECRET },
    )
    expect(res.status).toBe(200)
  })
})
