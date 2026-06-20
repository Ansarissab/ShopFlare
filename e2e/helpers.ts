import { expect, type APIResponse, type Locator, type Page } from '@playwright/test'

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

/** Navigate (with retry) without `networkidle` — the new store chrome keeps the
 *  dev network busy so it never settles. Callers assert on real elements instead. */
export async function gotoReady(page: Page, url: string): Promise<void> {
  await gotoWithRetry(page, url)
}

/** Retry `action` until `expectation` holds — defeats the hydration race where a
 *  client handler isn't wired yet so the first click/keypress is dropped.
 *  `action` must be idempotent or self-guarded so repeats are harmless. */
export async function actUntil(
  action: () => Promise<unknown>,
  expectation: () => Promise<unknown>,
  timeout = 15_000,
): Promise<void> {
  await expect(async () => {
    await action()
    await expectation()
  }).toPass({ timeout, intervals: [150, 300, 600, 1000] })
}

/** Press Escape until `panel` is hidden — close-side mirror of the open retry,
 *  for slow/early Escapes under load. Guarded so it stops once closed. */
export async function escapeUntilHidden(
  page: Page,
  panel: Locator,
  timeout = 10_000,
): Promise<void> {
  await actUntil(
    async () => {
      if (await panel.isVisible().catch(() => false)) await page.keyboard.press('Escape')
    },
    () => expect(panel).not.toBeVisible({ timeout: 1_500 }),
    timeout,
  )
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
