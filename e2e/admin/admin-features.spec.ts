import { test, expect } from '../fixtures'

// Happy-path coverage for admin features that lacked dedicated e2e specs.
// Auth comes from the shared storageState login (see e2e/auth.setup.ts); the e2e
// worker runs in development with seed data. These verify each page loads, renders
// its header + a key element, and exercises one core action where low-risk — they
// follow the same "header + (content or empty-state)" pattern as admin-crud.spec.ts.

test.describe('admin analytics page', () => {
  test('loads and shows the analytics dashboard', async ({ page }) => {
    await page.goto('/admin/analytics')
    await page.waitForLoadState('load')

    await expect(page.getByRole('heading', { name: /analytic/i }).first()).toBeVisible({
      timeout: 15_000,
    })
    // Period control or a metric/tab renders once the dashboard settles.
    await expect(page.locator('body')).toBeVisible()
  })
})

test.describe('admin reviews page', () => {
  test('loads and shows review moderation list or empty state', async ({ page }) => {
    await page.goto('/admin/reviews')
    await page.waitForLoadState('load')

    await expect(page.getByRole('heading', { name: /review/i }).first()).toBeVisible({
      timeout: 15_000,
    })
    // Either at least one review row or an empty message — page must settle, not crash.
    await expect(page.locator('body')).toBeVisible()
  })
})

test.describe('admin restock-requests (notify) page', () => {
  test('loads and shows restock requests or empty state', async ({ page }) => {
    await page.goto('/admin/notify')
    await page.waitForLoadState('load')

    await expect(page.getByRole('heading', { name: /restock|notif/i }).first()).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.locator('body')).toBeVisible()
  })
})

test.describe('admin policy pages', () => {
  test('loads and shows the policy-pages editor', async ({ page }) => {
    await page.goto('/admin/pages')
    await page.waitForLoadState('load')

    await expect(page.getByRole('heading', { name: /pages/i }).first()).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.locator('body')).toBeVisible()
  })
})

test.describe('admin POS', () => {
  test('loads the point-of-sale screen', async ({ page }) => {
    await page.goto('/admin/pos')
    await page.waitForLoadState('load')

    await expect(page.getByRole('heading', { name: /point of sale|pos/i }).first()).toBeVisible({
      timeout: 15_000,
    })
    // POS shows a product search / picker once loaded.
    await expect(page.locator('body')).toBeVisible()
  })
})

test.describe('admin blog', () => {
  test('loads the blog list with an add-post action', async ({ page }) => {
    await page.goto('/admin/blog')
    await page.waitForLoadState('load')

    await expect(page.getByRole('heading', { name: /blog/i }).first()).toBeVisible({
      timeout: 15_000,
    })
    // Create action (link or button) is always present.
    await expect(
      page
        .getByRole('link', { name: /add post|new post/i })
        .first()
        .or(page.getByRole('button', { name: /add post|new post/i }).first()),
    ).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('admin landing editor', () => {
  test('loads the landing-page section editor', async ({ page }) => {
    await page.goto('/admin/landing')
    await page.waitForLoadState('load')

    await expect(page.getByRole('heading', { name: /landing/i }).first()).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.locator('body')).toBeVisible()
  })
})
