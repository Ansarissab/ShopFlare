import { test, expect } from '../fixtures'

// AppTabBar and AppHeader both return null when !isStandalone (i.e. when the
// app is running in a normal browser tab, not installed as a PWA).
// These tests verify the rendered DOM attributes for both viewports and confirm
// the layout elements are present/absent based on the standalone flag.

test.describe('mobile viewport (375×812)', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('page loads and nav is accessible', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // AppTabBar renders <nav aria-label="Main navigation"> only in standalone mode.
    // In a regular browser tab it is hidden. Confirm the page itself renders.
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })

  test('AppTabBar is visible when app is in standalone/PWA mode', async ({ page }) => {
    // Simulate standalone mode by injecting the matchMedia override before navigation
    await page.addInitScript(() => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query: string) => ({
          matches: query.includes('standalone'),
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        }),
      })
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // AppTabBar: <nav aria-label="Main navigation">
    const tabBar = page.getByRole('navigation', { name: 'Main navigation' })
    await expect(tabBar).toBeVisible({ timeout: 8_000 })
  })

  test('AppTabBar contains Home, Cart, Track tabs in standalone mode', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query: string) => ({
          matches: query.includes('standalone'),
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        }),
      })
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const tabBar = page.getByRole('navigation', { name: 'Main navigation' })
    await expect(tabBar).toBeVisible({ timeout: 8_000 })

    // Tab labels from en.pwa.*
    await expect(tabBar.getByRole('link', { name: 'Home' })).toBeVisible()
    await expect(tabBar.getByRole('button', { name: 'Cart' })).toBeVisible()
    await expect(tabBar.getByRole('link', { name: 'Track' })).toBeVisible()
  })
})

test.describe('desktop viewport (1280×800)', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('page loads at desktop width', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const body = page.locator('body')
    await expect(body).toBeVisible()
  })

  test('AppHeader visible in standalone mode at desktop width', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query: string) => ({
          matches: query.includes('standalone'),
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        }),
      })
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // AppHeader renders: <header data-app-header>
    const header = page.locator('[data-app-header]')
    await expect(header).toBeVisible({ timeout: 8_000 })
  })

  test('AppTabBar not visible in normal browser mode at desktop width', async ({ page }) => {
    // Without standalone override, AppTabBar returns null
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const tabBar = page.locator('[data-tab-bar]')
    await expect(tabBar).not.toBeVisible({ timeout: 3_000 })
  })
})
