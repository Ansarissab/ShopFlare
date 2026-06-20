import type { APIResponse, Page } from '@playwright/test'

// The local e2e backend (next dev + wrangler dev + miniflare D1) gets unstable
// under sustained load: the heaviest route (the PDP, with its product+variants+
// images+reviews query chain) intermittently drops the connection mid-run with
// ERR_ABORTED / ECONNRESET / ERR_FAILED. The app is fine (these routes pass in
// isolation) — it's dev-server flakiness, so retry the navigation a couple times.
const TRANSIENT = /ERR_ABORTED|ECONNRESET|ERR_FAILED|ERR_CONNECTION|socket hang ?up/i

/** page.goto with a small retry on transient dev-server connection drops. */
export async function gotoWithRetry(page: Page, url: string, attempts = 3): Promise<void> {
  for (let i = 1; i <= attempts; i++) {
    try {
      await page.goto(url)
      return
    } catch (err) {
      if (i === attempts || !TRANSIENT.test(String(err))) throw err
      await page.waitForTimeout(500 * i)
    }
  }
}

/** page.request.get with the same transient-drop retry (for raw SSR HTML fetches). */
export async function requestGetWithRetry(
  page: Page,
  url: string,
  attempts = 3,
): Promise<APIResponse> {
  let lastErr: unknown
  for (let i = 1; i <= attempts; i++) {
    try {
      return await page.request.get(url)
    } catch (err) {
      lastErr = err
      if (!TRANSIENT.test(String(err))) throw err
      await page.waitForTimeout(500 * i)
    }
  }
  throw lastErr
}
