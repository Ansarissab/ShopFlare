import { test, expect } from './fixtures'

// Product media is remote placeholder imagery (picsum / swap-for-R2). Its paint
// timing over the network is non-deterministic, so every screenshot masks <img>
// elements — layout, typography, and chrome are what these baselines protect.
const mask = (page: import('@playwright/test').Page) => ({ mask: [page.locator('img')] })

// Wait for web fonts to settle before snapshotting — unloaded fonts shift glyph
// metrics and trip the diff. Run serially so host CPU contention can't smear paint.
const settle = (page: import('@playwright/test').Page) =>
  page.evaluate(() => document.fonts.ready.then(() => undefined))

test.describe.configure({ mode: 'serial' })

test.describe('visual: store', () => {
  test.beforeEach(async ({ page }) => {
    await page.waitForLoadState('networkidle')
  })

  test('home page', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await settle(page)
    await expect(page).toHaveScreenshot('home.png', mask(page))
  })

  test('cart sheet empty', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    // open cart — aria-label is "Open cart" per AppHeader.tsx
    const cartBtn = page.getByRole('button', { name: /cart/i }).first()
    if (await cartBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cartBtn.click()
    }
    await settle(page)
    await expect(page).toHaveScreenshot('cart-sheet.png', mask(page))
  })
})

test.describe('visual: admin', () => {
  test('admin dashboard', async ({ page }) => {
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')
    await settle(page)
    await expect(page).toHaveScreenshot('admin-dashboard.png', mask(page))
  })

  test('admin products', async ({ page }) => {
    await page.goto('/admin/products')
    await page.waitForLoadState('networkidle')
    await settle(page)
    await expect(page).toHaveScreenshot('admin-products.png', mask(page))
  })
})
