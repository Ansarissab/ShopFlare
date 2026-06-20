import { test, expect } from '../fixtures'
import { gotoReady, actUntil, escapeUntilHidden } from '../helpers'

// Phase-31 keyboard shortcuts — storefront layer.
// StoreShortcuts wires: / → search overlay, c → cart sheet, ? → shortcuts help.
// Listener attaches post-hydration, so each first press is retried via actUntil.

test.describe('store keyboard shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await gotoReady(page, '/')
  })

  test('@smoke / opens global search dialog, Escape closes it', async ({ page }) => {
    // Press `/` with no input focused — should open the search overlay
    const dialog = page.getByRole('dialog')
    await actUntil(
      // Guarded so a retry can't queue a stray press after it opens.
      async () => {
        if (!(await dialog.isVisible().catch(() => false))) await page.keyboard.press('/')
      },
      () => expect(dialog).toBeVisible({ timeout: 1_500 }),
    )

    // The overlay contains a search input placeholder
    await expect(dialog.locator('input[type="search"]')).toBeVisible()

    // Escape should close
    await escapeUntilHidden(page, dialog)
  })

  test('c opens cart sheet, Escape closes it', async ({ page }) => {
    const cartSheet = page.getByRole('dialog')
    await actUntil(
      async () => {
        if (!(await cartSheet.isVisible().catch(() => false))) await page.keyboard.press('c')
      },
      () => expect(cartSheet).toBeVisible({ timeout: 1_500 }),
    )

    await escapeUntilHidden(page, cartSheet)
  })

  test('? opens shortcuts cheat-sheet dialog titled "Keyboard shortcuts", Escape closes it', async ({
    page,
  }) => {
    // Match the help dialog by its heading so a slow/partial render (or another
    // dialog) can't satisfy the wait — keep pressing `?` until it's fully present.
    const dialog = page
      .getByRole('dialog')
      .filter({ has: page.getByRole('heading', { name: 'Keyboard shortcuts' }) })
    await actUntil(
      async () => {
        if (!(await dialog.isVisible().catch(() => false))) await page.keyboard.press('?')
      },
      () => expect(dialog).toBeVisible({ timeout: 1_500 }),
    )

    await escapeUntilHidden(page, dialog)
  })

  test('typing shortcut keys in a focused text input does NOT trigger shortcuts', async ({
    page,
  }) => {
    // Phase 29 removed the inline catalog SearchBar; the always-available text
    // input is the GlobalSearchOverlay's search field. Open it, focus the input,
    // then type shortcut chars — they must land in the input, not fire shortcuts.
    const dialog = page.getByRole('dialog')
    await actUntil(
      async () => {
        if (!(await dialog.isVisible().catch(() => false))) await page.keyboard.press('/')
      },
      () => expect(dialog).toBeVisible({ timeout: 1_500 }),
    )

    const input = dialog.locator('input[type="search"]')
    await input.click()
    await input.fill('')

    // Type `c` (cart shortcut) and `?` (help shortcut) INSIDE the focused input.
    await page.keyboard.type('c?')

    // Chars went into the input — no extra dialog/cart/help opened.
    await expect(input).toHaveValue('c?')
    // Still exactly one dialog (the search overlay), no cart/help stacked on top.
    await expect(page.getByRole('dialog')).toHaveCount(1)

    await escapeUntilHidden(page, dialog)
  })
})
