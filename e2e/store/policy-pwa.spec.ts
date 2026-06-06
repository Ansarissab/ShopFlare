import { test, expect } from '../fixtures'

test.describe('policy pages', () => {
  const POLICY_SLUGS = ['shipping', 'returns', 'privacy', 'terms']

  for (const slug of POLICY_SLUGS) {
    test(`/policy/${slug} loads without crashing`, async ({ page }) => {
      await page.goto(`/policy/${slug}`)
      await page.waitForLoadState('networkidle')

      // Either the page content renders or the "Page Not Found" state is shown —
      // both are valid when no policy content has been set yet.
      const backToStore = page.getByRole('link', { name: 'Back to store' })
      const visible = await backToStore.isVisible({ timeout: 8_000 }).catch(() => false)
      expect(visible).toBeTruthy()
    })
  }
})

test.describe('PWA manifest', () => {
  test('manifest link exists in <head>', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // Next.js adds <link rel="manifest" href="/manifest.webmanifest"> or similar
    const manifestLink = page.locator('link[rel="manifest"]')
    await expect(manifestLink).toHaveCount(1)

    const href = await manifestLink.getAttribute('href')
    expect(href).toBeTruthy()
  })

  test('manifest file is reachable', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    const manifestLink = page.locator('link[rel="manifest"]')
    const href = await manifestLink.getAttribute('href').catch(() => null)

    if (!href) {
      test.skip(true, 'No manifest link found in head')
      return
    }

    const response = await page.request.get(href)
    expect(response.status()).toBe(200)
  })
})
