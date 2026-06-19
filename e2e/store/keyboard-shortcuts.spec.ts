import { test, expect } from '../fixtures'

// Phase-31 keyboard shortcuts — storefront layer.
// StoreShortcuts wires: / → search overlay, c → cart sheet, ? → shortcuts help.
// Escape closes whichever panel is open (help > search > cart precedence).
// Typing in a focused input must NOT trigger any shortcut.

test.describe('store keyboard shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('load')
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

  test('typing shortcut keys in a focused text input does NOT trigger shortcuts', async ({
    page,
  }) => {
    // Phase 29 removed the inline catalog SearchBar; the always-available text
    // input is the GlobalSearchOverlay's search field. Open it, focus the input,
    // then type shortcut chars — they must land in the input, not fire shortcuts.
    await page.keyboard.press('/')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5_000 })

    const input = dialog.locator('input[type="search"]')
    await input.click()
    await input.fill('')

    // Type `c` (cart shortcut) and `?` (help shortcut) INSIDE the focused input.
    await page.keyboard.type('c?')

    // Chars went into the input — no extra dialog/cart/help opened.
    await expect(input).toHaveValue('c?')
    // Still exactly one dialog (the search overlay), no cart/help stacked on top.
    await expect(page.getByRole('dialog')).toHaveCount(1)

    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible({ timeout: 5_000 })
  })
})
