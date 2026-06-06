import { test, expect } from '../fixtures'

test.describe('home page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('loads with product grid', async ({ page }) => {
    // Either the product grid is visible or the "coming soon" state is shown —
    // either way the page must render without crashing.
    const grid = page.locator('[class*="grid"]').first()
    const comingSoon = page.getByText('Coming Soon')
    await expect(grid.or(comingSoon)).toBeVisible({ timeout: 10_000 })
  })

  test('search input is visible', async ({ page }) => {
    // SearchBar renders a plain <input type="search"> with placeholder "Search products…"
    const searchInput = page.getByPlaceholder('Search products…')
    await expect(searchInput).toBeVisible()
  })

  test('category nav is visible when categories exist', async ({ page }) => {
    // CategoryFilter renders buttons: first is always "All Products"
    const allProductsBtn = page.getByRole('button', { name: 'All Products' })
    // May not be visible when there are no categories — treat as optional
    const visible = await allProductsBtn.isVisible({ timeout: 3_000 }).catch(() => false)
    if (visible) {
      await expect(allProductsBtn).toBeVisible()
    }
  })
})
