import { test as setup, expect } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { ADMIN_STORAGE_STATE, ADMIN_TOKEN_KEY, E2E_ADMIN_PASSWORD, WORKER_URL } from './constants'

// One shared admin login for the whole e2e run. Playwright runs this `setup`
// project first (via `dependencies: ['setup']`); admin specs then reuse the saved
// storageState instead of logging in per test.
//
// The AdminShell only renders when shopflare_admin_token is in localStorage, so a
// worker-side ADMIN_DEV_BYPASS alone isn't enough — we log in for real (POST
// /api/admin/login with the deterministic e2e password the worker was booted with)
// and seed the returned token into localStorage.
setup('authenticate admin', async ({ request, baseURL }) => {
  // The API worker boots concurrently with next; poll the login until it's up.
  let token = ''
  await expect
    .poll(
      async () => {
        const res = await request
          .post(`${WORKER_URL}/api/admin/login`, { data: { password: E2E_ADMIN_PASSWORD } })
          .catch(() => null)
        if (res?.ok()) token = ((await res.json()) as { token: string }).token
        return res?.status() ?? 0
      },
      { timeout: 30_000, intervals: [500, 1000, 2000] },
    )
    .toBe(200)

  expect(token, 'no token returned from /api/admin/login').toBeTruthy()

  // Provision feature flags the storefront e2e needs. Blog is flag-gated (off in the
  // seed → /blog 404s); enable it so the store-blog spec has a page to load. Landing
  // is intentionally left OFF — turning it on moves the catalog to /shop and would
  // break the home specs that expect the grid at /.
  await request.put(`${WORKER_URL}/api/admin/config/store`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { blogEnabled: true },
  })

  // storageState is keyed by origin → use the app's baseURL (dynamic e2e port).
  const origin = baseURL ?? 'http://localhost:3000'
  const state = {
    cookies: [],
    origins: [{ origin, localStorage: [{ name: ADMIN_TOKEN_KEY, value: token }] }],
  }
  mkdirSync(dirname(ADMIN_STORAGE_STATE), { recursive: true })
  writeFileSync(ADMIN_STORAGE_STATE, JSON.stringify(state))
})
