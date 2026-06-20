import { test, expect } from '../fixtures'
import { gotoReady, actUntil, escapeUntilHidden } from '../helpers'

// Phase-31 keyboard shortcuts — admin layer.
// AdminShortcuts wires:
//   g o → /admin/orders
//   g p → /admin/products
//   g c → /admin/coupons
//   g a → /admin/analytics
//   /   → focus [data-shortcut-search]
//   ?   → shortcuts help dialog
//   j   → list next (highlight first/next row)
//   k   → list prev
// Typing sequences in a focused input must NOT trigger navigation.
// Listener attaches post-hydration, so each first shortcut is retried via actUntil.
// Admin login comes from storageState (playwright.config setup) — no per-test login.

test.describe('admin keyboard shortcuts — navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Start from admin root so URL assertions are clean and no prior nav state
    // interferes with the g+o/p/c/a sequences.
    await gotoReady(page, '/admin/orders')
    // Wait for the admin shell to render (proves the admin token was applied)
    await expect(page.getByRole('heading', { name: /orders/i })).toBeVisible({ timeout: 10_000 })
  })

  test('g then o navigates to /admin/orders', async ({ page }) => {
    await gotoReady(page, '/admin')

    await actUntil(
      async () => {
        await page.keyboard.press('g')
        await page.keyboard.press('o')
      },
      () => page.waitForURL('**/admin/orders', { timeout: 2_000 }),
      20_000,
    )
    expect(page.url()).toContain('/admin/orders')
  })

  test('g then p navigates to /admin/products', async ({ page }) => {
    await actUntil(
      async () => {
        await page.keyboard.press('g')
        await page.keyboard.press('p')
      },
      () => page.waitForURL('**/admin/products', { timeout: 2_000 }),
      20_000,
    )
    expect(page.url()).toContain('/admin/products')
  })

  test('g then c navigates to /admin/coupons', async ({ page }) => {
    await actUntil(
      async () => {
        await page.keyboard.press('g')
        await page.keyboard.press('c')
      },
      () => page.waitForURL('**/admin/coupons', { timeout: 2_000 }),
      20_000,
    )
    expect(page.url()).toContain('/admin/coupons')
  })

  test('g then a navigates to /admin/analytics', async ({ page }) => {
    await actUntil(
      async () => {
        await page.keyboard.press('g')
        await page.keyboard.press('a')
      },
      () => page.waitForURL('**/admin/analytics', { timeout: 2_000 }),
      20_000,
    )
    expect(page.url()).toContain('/admin/analytics')
  })
})

test.describe('admin keyboard shortcuts — overlays', () => {
  test.beforeEach(async ({ page }) => {
    await gotoReady(page, '/admin/orders')
    await expect(page.getByRole('heading', { name: /orders/i })).toBeVisible({ timeout: 10_000 })
  })

  test('? opens shortcuts help dialog, Escape closes it', async ({ page }) => {
    // Match the help dialog by its heading; guarded press avoids a stray retry.
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

  test('/ focuses the admin search input', async ({ page }) => {
    // AdminShortcuts search handler: document.querySelector('[data-shortcut-search]')?.focus()
    const searchInput = page.locator('[data-shortcut-search]')

    // Admin search is in the desktop header — check it exists
    const exists = await searchInput.count()
    if (exists === 0) {
      test.skip(true, 'Admin search input not found (may be hidden on mobile viewport) — skipping')
      return
    }

    await actUntil(
      async () => {
        if (!(await searchInput.evaluate((el) => el === document.activeElement).catch(() => false)))
          await page.keyboard.press('/')
      },
      () => expect(searchInput).toBeFocused({ timeout: 1_500 }),
    )
  })
})

test.describe('admin keyboard shortcuts — list navigation (j/k)', () => {
  test.beforeEach(async ({ page }) => {
    await gotoReady(page, '/admin/orders')
    await expect(page.getByRole('heading', { name: /orders/i })).toBeVisible({ timeout: 10_000 })
  })

  test('j highlights first table row, j again moves to next, k moves back', async ({ page }) => {
    // Only run when orders actually exist — empty-state has no rows
    const firstRow = page.locator('table tbody tr').first()
    const hasRows = await firstRow.isVisible({ timeout: 5_000 }).catch(() => false)

    if (!hasRows) {
      test.skip(true, 'No orders in seed — skipping j/k list navigation test')
      return
    }

    // j → row 0. Guard on the active class so a retry can't advance past row 0.
    await actUntil(
      async () => {
        const active = await firstRow
          .evaluate((el) => /ring-ring|bg-muted/.test(el.className))
          .catch(() => false)
        if (!active) await page.keyboard.press('j')
      },
      () => expect(firstRow).toHaveClass(/ring-ring|bg-muted/, { timeout: 1_500 }),
    )

    // Check if there's a second row before pressing j again
    const secondRow = page.locator('table tbody tr').nth(1)
    const hasSecondRow = await secondRow.isVisible({ timeout: 1_000 }).catch(() => false)

    if (hasSecondRow) {
      // j again → index 1 (second row highlighted, first no longer active)
      await page.keyboard.press('j')
      await expect(secondRow).toHaveClass(/ring-ring|bg-muted/, { timeout: 3_000 })

      // k → back to index 0
      await page.keyboard.press('k')
      await expect(firstRow).toHaveClass(/ring-ring|bg-muted/, { timeout: 3_000 })
    }
  })
})

test.describe('admin keyboard shortcuts — input guard', () => {
  test.beforeEach(async ({ page }) => {
    await gotoReady(page, '/admin/orders')
    await expect(page.getByRole('heading', { name: /orders/i })).toBeVisible({ timeout: 10_000 })
  })

  test('typing g then o inside admin search input does NOT navigate', async ({ page }) => {
    const searchInput = page.locator('[data-shortcut-search]')

    const exists = await searchInput.count()
    if (exists === 0) {
      test.skip(true, 'Admin search input not found — skipping input guard test')
      return
    }

    const initialUrl = page.url()

    // Focus the search input then type the g+o nav sequence
    await searchInput.click()
    await page.keyboard.type('g')
    await page.keyboard.type('o')

    // URL must NOT change — typing in an input should suppress nav shortcuts
    // Give a brief window for any potential navigation to have fired
    await page.waitForTimeout(500)
    expect(page.url()).toBe(initialUrl)

    // The input should contain the typed characters
    await expect(searchInput).toHaveValue('go')
  })
})
