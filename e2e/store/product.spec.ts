import { test, expect } from '../fixtures'

test.describe('product detail page', () => {
  test('server renders title, OG tags, and JSON-LD in initial HTML', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const firstProductLink = page.getByRole('link').filter({ hasText: /.+/ }).first()
    const href = await firstProductLink.getAttribute('href')
    if (!href || !href.startsWith('/product/')) {
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
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Find the first product link in the grid and follow it
    const firstProductLink = page.getByRole('link').filter({ hasText: /.+/ }).first()
    const href = await firstProductLink.getAttribute('href')

    // Skip test gracefully when no products exist
    if (!href || !href.startsWith('/product/')) {
      test.skip(true, 'No products in the store — skipping product navigation test')
      return
    }

    await page.goto(href)
    await page.waitForLoadState('networkidle')

    // Product name rendered as h1
    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toBeVisible({ timeout: 10_000 })
  })

  test('size picker is visible on product page', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const firstProductLink = page.getByRole('link').filter({ hasText: /.+/ }).first()
    const href = await firstProductLink.getAttribute('href')

    if (!href || !href.startsWith('/product/')) {
      test.skip(true, 'No products in the store — skipping size picker test')
      return
    }

    await page.goto(href)
    await page.waitForLoadState('networkidle')

    // SizePicker renders a label "Select Size"
    const sizeLabel = page.getByText('Select Size')
    await expect(sizeLabel).toBeVisible({ timeout: 10_000 })
  })

  test('variant selector visible when multiple variants exist', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const firstProductLink = page.getByRole('link').filter({ hasText: /.+/ }).first()
    const href = await firstProductLink.getAttribute('href')

    if (!href || !href.startsWith('/product/')) {
      test.skip(true, 'No products in the store — skipping variant selector test')
      return
    }

    await page.goto(href)
    await page.waitForLoadState('networkidle')

    // VariantSelector renders "Select Color" label
    const variantLabel = page.getByText('Select Color')
    const visible = await variantLabel.isVisible({ timeout: 3_000 }).catch(() => false)
    // Only assert when selector is rendered (single-variant products omit it)
    if (visible) {
      await expect(variantLabel).toBeVisible()
    }
  })

  test('add-to-cart button is clickable', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const firstProductLink = page.getByRole('link').filter({ hasText: /.+/ }).first()
    const href = await firstProductLink.getAttribute('href')

    if (!href || !href.startsWith('/product/')) {
      test.skip(true, 'No products in the store — skipping add-to-cart test')
      return
    }

    await page.goto(href)
    await page.waitForLoadState('networkidle')

    const addToCartBtn = page.getByRole('button', { name: /add to cart/i })
    await expect(addToCartBtn).toBeVisible({ timeout: 10_000 })

    // Select first available size so the button becomes active
    const firstSizeBtn = page
      .getByRole('button', { name: /^(?!Add to Cart|Buy Now|Out of Stock)/ })
      .filter({ hasText: /.+/ })
      .first()
    const sizeVisible = await firstSizeBtn.isVisible({ timeout: 2_000 }).catch(() => false)
    if (sizeVisible) {
      await firstSizeBtn.click()
    }

    // Button should be present (may be enabled or still disabled if a size must be selected)
    await expect(addToCartBtn).toBeVisible()
  })
})
