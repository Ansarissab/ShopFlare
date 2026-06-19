import { test, expect } from '../fixtures'

// Happy-path coverage for storefront pages that lacked dedicated e2e specs.
// /status is always available; /blog and /shop are feature-flagged, so those tests
// skip when the feature is off in the seed rather than asserting a hard 404.

test.describe('status page', () => {
  test('loads and shows service health indicators', async ({ page }) => {
    await page.goto('/status')
    await page.waitForLoadState('load')

    // Header (en.status.title renders as the page heading).
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 15_000 })
    // The page probes database / storage / media; their labels render either way
    // (operational or degraded). Just assert the page settled with content.
    await expect(
      page.getByText(/database|storage|media|operational|degraded/i).first(),
    ).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('store blog', () => {
  // Blog is enabled for e2e in auth.setup.ts (it's flag-gated, off in the seed).
  test('blog index loads with its heading', async ({ page }) => {
    await page.goto('/blog')
    await page.waitForLoadState('load')
    // h1 "Blog" (en.blog.pageTitle) — list of posts or the empty "no posts" state.
    await expect(page.getByRole('heading', { name: /blog/i }).first()).toBeVisible({
      timeout: 15_000,
    })
  })
})

// Note: /shop is intentionally NOT covered here. It exists only when landingEnabled
// is ON, which moves the catalog off `/` and conflicts with the home specs; the same
// Catalog component is already covered at `/` (home.spec.ts) and via product specs.
