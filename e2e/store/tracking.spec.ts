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
    await page.getByRole('button', { name: 'Track' }).click()

    // Worker returns 404 → tracking page shows "Order not found"
    // or browser navigates to /track/ORD-INVALID-9999 and displays the error
    await page.waitForLoadState('networkidle')
    const notFound = page.getByText(/order not found/i)
    const visible = await notFound.isVisible({ timeout: 8_000 }).catch(() => false)
    // Just confirm the page handles the error without crashing
    expect(visible || page.url().includes('/track/')).toBeTruthy()
  })
})
