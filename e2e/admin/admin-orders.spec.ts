import { test, expect } from '../fixtures'

// Admin orders + POS smoke tests.
// No mutations — just verify pages load and key UI elements are present.
// ADMIN_DEV_BYPASS=1 keeps CF Access out of the way in wrangler dev.

test.describe('admin orders page', () => {
  test('loads and shows orders table or empty state', async ({ page }) => {
    await page.goto('/admin/orders')
    await page.waitForLoadState('networkidle')

    // Page has Orders heading
    await expect(page.getByRole('heading', { name: /orders/i })).toBeVisible()

    // Status filter dropdown is present
    await expect(page.getByRole('combobox')).toBeVisible()

    // Either a table (has Order / Customer column headers) or empty message —
    // auto-wait for whichever settles (async list load can lag under parallel load).
    await expect(
      page.locator('th', { hasText: /order/i }).first().or(page.getByText('No orders found')),
    ).toBeVisible({ timeout: 15_000 })
  })

  test('status filter dropdown contains expected options', async ({ page }) => {
    await page.goto('/admin/orders')
    await page.waitForLoadState('networkidle')

    const trigger = page.getByRole('combobox')
    await expect(trigger).toBeVisible()
    await trigger.click()

    // "All" option must always appear
    await expect(page.getByRole('option', { name: /^all$/i })).toBeVisible()

    // At least one status option — pending or confirmed (both may exist; take first)
    await expect(
      page.getByRole('option', { name: /pending|confirmed/i }).first(),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('order row links are navigable', async ({ page }) => {
    await page.goto('/admin/orders')
    await page.waitForLoadState('networkidle')

    // If the table has at least one row, clicking the order number should navigate
    const firstOrderLink = page.locator('table tbody tr td a').first()
    const hasOrders = await firstOrderLink.isVisible().catch(() => false)

    if (hasOrders) {
      const href = await firstOrderLink.getAttribute('href')
      expect(href).toMatch(/^\/admin\/orders\//)
    }
    // No orders in seed → skip navigation; the empty state already tested above
  })
})

test.describe('admin POS page', () => {
  test('loads and shows POS interface', async ({ page }) => {
    await page.goto('/admin/pos')
    await page.waitForLoadState('networkidle')

    // POS page title (en.pos.title → "Point of Sale")
    await expect(page.getByRole('heading', { name: /point of sale/i })).toBeVisible()
  })

  test('POS product selector is visible', async ({ page }) => {
    await page.goto('/admin/pos')
    await page.waitForLoadState('networkidle')

    // POSScreen renders product + variant + size selects or a skeleton while loading.
    // After networkidle, at minimum a Select trigger or skeleton should be in DOM.
    await expect(
      page.getByRole('combobox').first().or(page.locator('[class*="skeleton"], [class*="animate-pulse"]').first()),
    ).toBeVisible({ timeout: 15_000 })
  })

  test('POS cart area is present', async ({ page }) => {
    await page.goto('/admin/pos')
    await page.waitForLoadState('networkidle')

    // Cart section: customer phone input or the completed order message
    // The phone FormField has id starting with customer or contains "phone"
    const phoneInput = page.locator('input[type="tel"], input[placeholder*="phone" i], input[placeholder*="+92" i]').first()
    await expect(phoneInput).toBeVisible({ timeout: 5000 })
  })
})
