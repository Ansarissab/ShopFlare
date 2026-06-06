import { test, expect } from './fixtures'

test.describe('visual: store', () => {
  test.beforeEach(async ({ page }) => {
    await page.waitForLoadState('networkidle')
  })

  test('home page', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot('home.png')
  })

  test('cart sheet empty', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    // open cart — aria-label is "Open cart" per AppHeader.tsx
    const cartBtn = page.getByRole('button', { name: /cart/i }).first()
    if (await cartBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cartBtn.click()
    }
    await expect(page).toHaveScreenshot('cart-sheet.png')
  })
})

test.describe('visual: admin', () => {
  test('admin dashboard', async ({ page }) => {
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot('admin-dashboard.png')
  })

  test('admin products', async ({ page }) => {
    await page.goto('/admin/products')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot('admin-products.png')
  })
})
