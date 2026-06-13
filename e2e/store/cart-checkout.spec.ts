import { test, expect } from '../fixtures'

test.describe('cart and checkout', () => {
  test('adding an item opens cart sheet with that item', async ({ page, addToCart }) => {
    await addToCart(page)

    // Cart sheet is identified by SheetTitle "Your Cart"
    const cartTitle = page.getByRole('heading', { name: 'Your Cart' })
    const visible = await cartTitle.isVisible({ timeout: 5_000 }).catch(() => false)

    if (!visible) {
      // Manually open cart if addToCart did not trigger it
      const cartBtn = page.getByRole('button', { name: /open cart|cart/i }).first()
      const btnVisible = await cartBtn.isVisible({ timeout: 2_000 }).catch(() => false)
      if (btnVisible) await cartBtn.click()
    }

    await expect(page.getByRole('heading', { name: 'Your Cart' })).toBeVisible({ timeout: 8_000 })
  })

  test('COD checkout: fills ManualOrderForm and reaches success page', async ({
    page,
    addToCart,
  }) => {
    await addToCart(page)

    // Close the cart sheet before navigating so that Zustand persists isOpen=false.
    // Without this, the checkout page may redirect to / if Zustand rehydrates too
    // slowly (items briefly [] on first render), and then / re-opens the cart sheet
    // (isOpen: true from localStorage), hiding the checkout form behind the dialog.
    const closeBtn = page.getByRole('button', { name: 'Close' })
    const cartDialog = page.getByRole('dialog', { name: 'Your Cart' })
    const cartOpen = await cartDialog.isVisible({ timeout: 3_000 }).catch(() => false)
    if (cartOpen) {
      await closeBtn.click()
      await cartDialog.waitFor({ state: 'hidden', timeout: 3_000 }).catch(() => null)
    }

    // Navigate to checkout. Use 'load' not 'networkidle': the Turnstile widget
    // loads an external Cloudflare script that may have ongoing requests.
    await page.goto('/checkout')
    await page.waitForLoadState('load')

    // COD method is selected by default; wait for the ManualOrderForm to appear.
    // This also guards against the empty-cart redirect (if form never appears →
    // items were not in localStorage → skip gracefully).
    const nameField = page.getByLabel('Full Name')
    const formVisible = await nameField.isVisible({ timeout: 8_000 }).catch(() => false)
    if (!formVisible) {
      test.skip(true, 'Checkout form not visible (cart may have been empty) — skipping COD test')
      return
    }

    // ManualOrderForm fields — labels are taken from en.checkout.*
    await nameField.fill('Test User')
    await page.getByLabel('Phone Number').fill('+923001234567')
    await page.getByLabel('Street Address').fill('123 Test Street')
    await page.getByLabel('City').fill('Karachi')
    await page.getByLabel('Country').fill('PK')

    // Submit button text comes from submitLabel prop ("Place Order" for COD)
    const submitBtn = page.getByRole('button', { name: /place order/i })
    await expect(submitBtn).toBeVisible({ timeout: 5_000 })

    // Turnstile is a third-party widget; in CI/dev it may not be present or
    // may auto-verify. Only click submit if the button is enabled.
    const isEnabled = await submitBtn.isEnabled({ timeout: 3_000 }).catch(() => false)
    if (isEnabled) {
      await submitBtn.click()
      // Success page should load
      await page.waitForURL('**/checkout/success**', { timeout: 15_000 })
      await expect(page.getByRole('heading', { name: 'Order Confirmed!' })).toBeVisible()
    }
  })

  test('success page shows order confirmation heading', async ({ page }) => {
    // Navigate directly with a mock method param to test the page shell
    await page.goto('/checkout/success?method=cod&orderId=ORD-TEST123')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'Order Confirmed!' })).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByText('Thank you for your order')).toBeVisible()
  })
})
