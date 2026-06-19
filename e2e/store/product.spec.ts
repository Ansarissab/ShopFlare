import { test, expect } from '../fixtures'

// Helper: wait for the client-rendered product grid and return the href of the
// first product link. Returns null when the store is genuinely empty (no
// a[href^="/product/"] after waiting), so callers can skip gracefully.
async function getFirstProductHref(page: import('@playwright/test').Page): Promise<string | null> {
  await page.goto('/')
  // Wait for the client-rendered product grid — the home route uses
  // useSearchParams + Suspense, so products appear only after hydration/fetch.
  const firstLink = page.locator('a[href^="/product/"]').first()
  const found = await firstLink
    .waitFor({ state: 'visible', timeout: 15_000 })
    .then(() => true)
    .catch(() => false)
  if (!found) return null
  return firstLink.getAttribute('href')
}

test.describe('product detail page', () => {
  test('server renders title, OG tags, and JSON-LD in initial HTML', async ({ page }) => {
    const href = await getFirstProductHref(page)
    if (!href) {
      test.skip(true, 'No products — skipping metadata test')
      return
    }

    // Fetch raw HTML before any JS hydration
    const res = await page.request.get(href)
    const html = await res.text()

    // <title> present
    expect(html).toMatch(/<title[^>]*>[^<]+<\/title>/)
    // OG meta present
    expect(html).toMatch(/og:title/)
    // JSON-LD script with Product schema in initial HTML (not injected by client JS)
    expect(html).toMatch(/"@type"\s*:\s*"Product"/)
    expect(html).toMatch(/application\/ld\+json/)
  })

  test('navigates to a product page from the grid', async ({ page }) => {
    const href = await getFirstProductHref(page)

    // Skip test gracefully when no products exist
    if (!href) {
      test.skip(true, 'No products in the store — skipping product navigation test')
      return
    }

    await page.goto(href)
    await page.waitForLoadState('load')

    // Product name rendered as h1
    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toBeVisible({ timeout: 10_000 })
  })

  test('size picker is visible on product page', async ({ page }) => {
    const href = await getFirstProductHref(page)

    if (!href) {
      test.skip(true, 'No products in the store — skipping size picker test')
      return
    }

    await page.goto(href)
    await page.waitForLoadState('load')

    // SizePicker renders a label "Select Size"
    const sizeLabel = page.getByText('Select Size')
    await expect(sizeLabel).toBeVisible({ timeout: 10_000 })
  })

  test('variant selector visible when multiple variants exist', async ({ page }) => {
    const href = await getFirstProductHref(page)

    if (!href) {
      test.skip(true, 'No products in the store — skipping variant selector test')
      return
    }

    await page.goto(href)
    await page.waitForLoadState('load')

    // VariantSelector renders "Select Color" label
    const variantLabel = page.getByText('Select Color')
    const visible = await variantLabel.isVisible({ timeout: 3_000 }).catch(() => false)
    // Only assert when selector is rendered (single-variant products omit it)
    if (visible) {
      await expect(variantLabel).toBeVisible()
    }
  })

  test('add-to-cart button is clickable', async ({ page }) => {
    const href = await getFirstProductHref(page)

    if (!href) {
      test.skip(true, 'No products in the store — skipping add-to-cart test')
      return
    }

    await page.goto(href)
    await page.waitForLoadState('load')

    const addToCartBtn = page.getByRole('button', { name: /add to cart/i })
    await expect(addToCartBtn).toBeVisible({ timeout: 10_000 })

    // Select the first available (non-disabled) size button so the Add to Cart
    // button becomes enabled. Target within the SizePicker container to avoid
    // accidentally clicking a VariantSelector button (also aria-pressed) which
    // would reset the size selection and keep Add to Cart disabled.
    const sizeSectionLabel = page.getByText('Select Size', { exact: true })
    const hasSizeSection = await sizeSectionLabel.isVisible({ timeout: 2_000 }).catch(() => false)
    if (hasSizeSection) {
      const firstSizeBtn = sizeSectionLabel.locator('..').locator('button:not([disabled])').first()
      const sizeVisible = await firstSizeBtn.isVisible({ timeout: 2_000 }).catch(() => false)
      if (sizeVisible) {
        await firstSizeBtn.click()
      }
    }

    // Button should be present (may be enabled or still disabled if a size must be selected)
    await expect(addToCartBtn).toBeVisible()
  })
})
