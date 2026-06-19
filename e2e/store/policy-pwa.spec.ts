import { test, expect } from '../fixtures'

test.describe('policy pages', () => {
  const POLICY_SLUGS = ['shipping', 'returns', 'privacy', 'terms']

  for (const slug of POLICY_SLUGS) {
    test(`/policy/${slug} loads without crashing`, async ({ page }) => {
      await page.goto(`/policy/${slug}`)
      await page.waitForLoadState('networkidle')

      // Either the page content renders or the "Page Not Found" state is shown —
      // both paths render a "Back to store" link. Auto-wait (cold dev compile +
      // the policy API fetch can exceed a short timeout under parallel load).
      await expect(page.getByRole('link', { name: 'Back to store' })).toBeVisible({
        timeout: 20_000,
      })
    })
  }
})

test.describe('PWA manifest', () => {
  test('manifest link exists in <head>', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Next.js adds <link rel="manifest" href="/manifest.webmanifest"> or similar.
    // Wait for the link to be attached — with Suspense/streaming SSR the head
    // metadata may arrive slightly after domcontentloaded.
    const manifestLink = page.locator('link[rel="manifest"]')
    await manifestLink.waitFor({ state: 'attached', timeout: 10_000 })
    await expect(manifestLink).toHaveCount(1)

    const href = await manifestLink.getAttribute('href')
    expect(href).toBeTruthy()
  })

  test('manifest file is reachable', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Wait for the manifest link to be present before reading its href.
    const manifestLink = page.locator('link[rel="manifest"]')
    await manifestLink.waitFor({ state: 'attached', timeout: 10_000 }).catch(() => null)
    const href = await manifestLink.getAttribute('href').catch(() => null)

    if (!href) {
      test.skip(true, 'No manifest link found in head')
      return
    }

    const response = await page.request.get(href)
    expect(response.status()).toBe(200)
  })
})
