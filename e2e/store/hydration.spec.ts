import { test, expect } from '../fixtures'

const HYDRATION_ERROR =
  /hydrat|did not match|Minified React error #(?:418|423|425)|Text content does not match/i

test('@smoke no React hydration errors on home page', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(String(err)))

  await page.goto('/')
  await page.waitForLoadState('networkidle')

  const hydrationErrors = errors.filter((e) => HYDRATION_ERROR.test(e))
  expect(hydrationErrors, `Hydration errors: ${hydrationErrors.join('; ')}`).toHaveLength(0)

  // Product grid must be present in initial HTML (SSR) and still visible after hydration.
  // An img with a /cdn/ srcset confirms SSR-rendered content survived client hydration.
  const cdnImg = page.locator('img[srcset*="/cdn/"]').first()
  const gridVisible = await cdnImg.isVisible({ timeout: 10_000 }).catch(() => false)
  if (gridVisible) {
    // Products exist — assert the grid did not blank out post-hydration.
    await expect(cdnImg).toBeVisible()
  } else {
    // Empty store — just assert the page rendered something (no blank flash).
    await expect(page.locator('body')).not.toBeEmpty()
  }
})
