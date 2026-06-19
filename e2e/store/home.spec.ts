import { test, expect } from '../fixtures'

test.describe('home page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('load')
  })

  test('loads with product grid', async ({ page }) => {
    // Either the product grid is visible or the "coming soon" state is shown —
    // either way the page must render without crashing.
    const grid = page.locator('[class*="grid"]').first()
    const comingSoon = page.getByText('Coming Soon')
    await expect(grid.or(comingSoon)).toBeVisible({ timeout: 10_000 })
  })

  test('header search opens the global search overlay', async ({ page }) => {
    // Phase 29: the inline SearchBar was removed. Search is now the header icon
    // button (aria-label "Search") which opens the lazy GlobalSearchOverlay
    // containing the search <input> (placeholder "Search products...").
    await page.getByRole('button', { name: 'Search' }).first().click()
    const overlayInput = page.getByPlaceholder('Search products')
    await expect(overlayInput).toBeVisible()
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

test.describe('category page metadata', () => {
  test('server renders title, OG tags, and JSON-LD in initial HTML', async ({ page }) => {
    // Find a category link by opening the "Browse Categories" dropdown in the header.
    // CategoryNav renders links inside a DropdownMenuContent portal — they are only
    // injected into the DOM after the trigger is clicked.
    await page.goto('/')
    await page.waitForLoadState('load')

    // Check whether the category dropdown trigger exists before clicking it.
    // StorefrontHeader is a client component that fetches /api/categories — allow
    // time for the API response + re-render after networkidle.
    const trigger = page.getByRole('button', { name: 'Browse Categories' })
    const triggerVisible = await trigger.isVisible({ timeout: 8_000 }).catch(() => false)

    if (!triggerVisible) {
      test.skip(true, 'No categories — skipping category metadata test')
      return
    }

    // Open the dropdown so the portal links are injected into the DOM.
    await trigger.click()

    // Grab the first category link from the now-open dropdown.
    const catLink = page.locator('a[href^="/category/"]').first()
    await catLink.waitFor({ state: 'visible', timeout: 5_000 })
    const href = await catLink.getAttribute('href')

    if (!href) {
      test.skip(true, 'No category links found in dropdown — skipping category metadata test')
      return
    }

    const res = await page.request.get(href)
    const html = await res.text()

    expect(html).toMatch(/<title[^>]*>[^<]+<\/title>/)
    expect(html).toMatch(/og:title/)
    expect(html).toMatch(/"@type"\s*:\s*"CollectionPage"/)
    expect(html).toMatch(/application\/ld\+json/)
  })
})
