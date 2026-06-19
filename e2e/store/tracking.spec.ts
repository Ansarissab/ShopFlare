import { test, expect } from '../fixtures'

test.describe('order tracking', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/track')
    await page.waitForLoadState('networkidle')
  })

  test('/track page loads with title', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Track Your Order' })).toBeVisible()
  })

  test('order number input is visible', async ({ page }) => {
    // TrackingForm labels: en.tracking.orderNumber = "Order Number"
    await expect(page.getByLabel('Order Number')).toBeVisible()
  })

  test('email or phone input is visible', async ({ page }) => {
    // TrackingForm labels: en.tracking.email = "Email or Phone"
    await expect(page.getByLabel('Email or Phone')).toBeVisible()
  })

  test('track button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Track' })).toBeVisible()
  })

  test('submitting empty form shows required error', async ({ page }) => {
    await page.getByRole('button', { name: 'Track' }).click()

    // TrackingForm shows: "Order Number is required" when field is blank
    await expect(page.getByText(/order number.*required/i)).toBeVisible({ timeout: 5_000 })
  })

  test('submitting invalid order number shows error or redirects', async ({ page }) => {
    await page.getByLabel('Order Number').fill('ORD-INVALID-9999')
    await page.getByLabel('Email or Phone').fill('test@example.com')

    // The form router.push()es to /track/:orderId; App Router holds the URL until
    // the route's RSC payload is ready, which on a cold Turbopack dev compile can
    // take well over the default timeout — wait for the navigation explicitly.
    await Promise.all([
      page.waitForURL(/\/track\/ORD-INVALID-9999/, { timeout: 30_000 }),
      page.getByRole('button', { name: 'Track' }).click(),
    ])

    // Worker returns 404 → tracking page shows "Order not found"
    await expect(page.getByText(/order not found/i)).toBeVisible({ timeout: 15_000 })
  })
})
