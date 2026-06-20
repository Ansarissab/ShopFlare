import { test, expect } from '../fixtures'
import { gotoReady, actUntil } from '../helpers'

test.describe('order tracking', () => {
  test.beforeEach(async ({ page }) => {
    await gotoReady(page, '/track')
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
    // Retry click until the (post-hydration) onSubmit fires client validation.
    await actUntil(
      () => page.getByRole('button', { name: 'Track' }).click(),
      () => expect(page.getByText(/order number.*required/i)).toBeVisible({ timeout: 1_000 }),
    )
  })

  test('submitting invalid order number shows error or redirects', async ({ page }) => {
    // The dynamic /track/[orderId] route can cold-compile slowly under Turbopack.
    test.setTimeout(60_000)

    // Fill + click inside the retry: a pre-hydration fill is wiped when React
    // hydrates the controlled inputs, so re-fill each attempt. URL-guarded so we
    // stop after navigating; commit resolves on URL change (skip slow RSC load).
    await actUntil(
      async () => {
        if (!/\/track\/ORD-INVALID-9999/.test(page.url())) {
          await page.getByLabel('Order Number').fill('ORD-INVALID-9999')
          await page.getByLabel('Email or Phone').fill('test@example.com')
          await page.getByRole('button', { name: 'Track' }).click()
        }
      },
      () => page.waitForURL(/\/track\/ORD-INVALID-9999/, { timeout: 8_000, waitUntil: 'commit' }),
      40_000,
    )

    // Worker returns 404 → tracking page shows "Order not found"
    await expect(page.getByText(/order not found/i)).toBeVisible({ timeout: 20_000 })
  })
})
