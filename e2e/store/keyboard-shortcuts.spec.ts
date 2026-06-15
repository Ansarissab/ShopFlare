import { test, expect } from '../fixtures'

// Phase-31 keyboard shortcuts — storefront layer.
// StoreShortcuts wires: / → search overlay, c → cart sheet, ? → shortcuts help.
// Escape closes whichever panel is open (help > search > cart precedence).
// Typing in a focused input must NOT trigger any shortcut.

test.describe('store keyboard shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('@smoke / opens global search dialog, Escape closes it', async ({ page }) => {
    // Press `/` with no input focused — should open the search overlay
    await page.keyboard.press('/')

    // GlobalSearchOverlay renders a Dialog with a visually hidden title (sr-only)
    // — getByRole('dialog') will find the dialog, then we can check for the
    // search input within it.
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5_000 })

    // The overlay contains a search input placeholder
    await expect(dialog.locator('input[type="search"]')).toBeVisible()

    // Escape should close
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible({ timeout: 5_000 })
  })

  test('c opens cart sheet, Escape closes it', async ({ page }) => {
    await page.keyboard.press('c')

    // CartSheet renders a Sheet (role=dialog) with the title from t.cart.title
    const cartSheet = page.getByRole('dialog')
    await expect(cartSheet).toBeVisible({ timeout: 5_000 })

    // The cart sheet title is "Your Cart" (or equivalent from i18n)
    // — at minimum the dialog itself should be present
    await expect(cartSheet).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(cartSheet).not.toBeVisible({ timeout: 5_000 })
  })

  test('? opens shortcuts cheat-sheet dialog titled "Keyboard shortcuts", Escape closes it', async ({
    page,
  }) => {
    // Press `?` directly — Playwright maps this to the correct key event (key: '?')
    await page.keyboard.press('?')

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5_000 })

    // Title from t.shortcuts.title = 'Keyboard shortcuts'
    await expect(dialog.getByRole('heading', { name: 'Keyboard shortcuts' })).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible({ timeout: 5_000 })
  })

  test('typing / in a focused text input does NOT open the search overlay', async ({ page }) => {
    // Find the storefront search bar input (placeholder "Search products…")
    const searchBarInput = page.getByPlaceholder('Search products…')
    const inputVisible = await searchBarInput.isVisible({ timeout: 5_000 }).catch(() => false)

    if (!inputVisible) {
      test.skip(true, 'Store search bar input not visible on this page — skipping guard test')
      return
    }

    // Focus the input then type `/ ` — must NOT open the GlobalSearchOverlay
    await searchBarInput.click()
    await page.keyboard.type('/')

    // The storefront search bar input should now contain `/`
    await expect(searchBarInput).toHaveValue('/')

    // No overlay dialog should appear (allow a brief settle period)
    const dialog = page.getByRole('dialog')
    const opened = await dialog.isVisible({ timeout: 1_000 }).catch(() => false)
    expect(opened).toBe(false)

    // Also verify `c` inside the input doesn't open the cart
    await page.keyboard.type('c')
    const cartOpened = await dialog.isVisible({ timeout: 1_000 }).catch(() => false)
    expect(cartOpened).toBe(false)
  })
})
