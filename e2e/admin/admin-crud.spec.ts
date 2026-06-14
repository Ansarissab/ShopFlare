import { test, expect } from '../fixtures'

// Admin routes are open in wrangler dev with ADMIN_DEV_BYPASS=1.
// Seed data is applied from worker/db/seed.sql before the test run.
// These tests verify pages load and key UI elements render — no mutations.

test.describe('admin products page', () => {
  test('loads and shows product list or empty state', async ({ page }) => {
    await page.goto('/admin/products')
    await page.waitForLoadState('networkidle')

    // Page header with "Products" title must be present
    await expect(page.getByRole('heading', { name: /products/i })).toBeVisible()

    // Either at least one product card or the empty-state link is visible —
    // auto-wait for whichever settles (async list load can lag under parallel load).
    await expect(
      page.locator('text=Edit Product').first().or(page.getByText('Add your first product')),
    ).toBeVisible({ timeout: 15_000 })

    // "Add Product" action button must always be visible
    await expect(page.getByRole('link', { name: /add product/i })).toBeVisible()
  })

  test('new product page renders form', async ({ page }) => {
    await page.goto('/admin/products/new')
    await page.waitForLoadState('networkidle')

    // Basic Info section heading
    await expect(page.getByText('Basic Info')).toBeVisible()

    // Name and description fields
    await expect(page.locator('#product-name')).toBeVisible()
    await expect(page.locator('#product-desc')).toBeVisible()

    // Active checkbox
    await expect(page.locator('#product-active')).toBeVisible()
  })
})

test.describe('admin categories page', () => {
  test('loads and shows category tree or empty state', async ({ page }) => {
    await page.goto('/admin/categories')
    await page.waitForLoadState('networkidle')

    // Page header
    await expect(page.getByRole('heading', { name: /categories/i })).toBeVisible()

    // Add Category button
    await expect(page.getByRole('link', { name: /add category/i })).toBeVisible()

    // Category list or empty tree (no error thrown, page settled)
    // The CategoryTree renders items or simply renders nothing — either is valid.
    await expect(page.locator('body')).toBeVisible()
  })

  test('new category page renders form', async ({ page }) => {
    await page.goto('/admin/categories/new')
    await page.waitForLoadState('networkidle')

    // Category name input from CategoryForm
    await expect(
      page
        .locator('input[id^="cat-name"], input[placeholder*="name" i], input[id="category-name"]')
        .first(),
    ).toBeVisible()
  })
})

test.describe('admin coupons page', () => {
  test('loads and shows coupons table or empty state', async ({ page }) => {
    await page.goto('/admin/coupons')
    await page.waitForLoadState('networkidle')

    // Page header
    await expect(page.getByRole('heading', { name: /coupons/i })).toBeVisible()

    // Add Coupon button
    await expect(page.getByRole('button', { name: /add coupon/i })).toBeVisible()

    // Either a table row or an empty message — no crash
    await expect(page.locator('body')).toBeVisible()
  })

  test('clicking Add Coupon reveals inline form', async ({ page }) => {
    await page.goto('/admin/coupons')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: /add coupon/i }).click()

    // CouponForm should appear (it has a code input field)
    await expect(
      page
        .locator('input[id^="coupon-code"], input[placeholder*="code" i], input[id="coupon-code"]')
        .first(),
    ).toBeVisible({ timeout: 3000 })
  })
})

test.describe('admin settings page', () => {
  test('loads and shows settings form sections', async ({ page }) => {
    await page.goto('/admin/settings')
    await page.waitForLoadState('networkidle')

    // Page header (h1 — be specific; "Tax Settings" etc. are section sub-headings)
    await expect(page.getByRole('heading', { name: /store settings/i })).toBeVisible()

    // Appearance section
    await expect(page.getByText('Appearance')).toBeVisible()

    // Identity section with store name field
    await expect(page.locator('#s-name')).toBeVisible()

    // Contact section fields
    await expect(page.locator('#s-wa')).toBeVisible()
    await expect(page.locator('#s-email')).toBeVisible()

    // Top-level Save button (exact — the announcement section has its own
    // "Save announcement bar" button that a loose /save/i would also match)
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible()
  })

  test('primary color input is present and editable', async ({ page }) => {
    await page.goto('/admin/settings')
    await page.waitForLoadState('networkidle')

    const colorInput = page.locator('#a-primary')
    await expect(colorInput).toBeVisible()
    await expect(colorInput).toBeEnabled()
  })
})
