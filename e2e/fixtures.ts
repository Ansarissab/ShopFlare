import { test as base, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { gotoWithRetry } from './helpers'

type ShopFlareFixtures = {
  consoleErrors: string[]
  checkA11y: (page: import('@playwright/test').Page) => Promise<void>
  addToCart: (page: import('@playwright/test').Page, productPath?: string) => Promise<void>
}

export const test = base.extend<ShopFlareFixtures>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = []
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text())
      })
      page.on('pageerror', (err) => errors.push(String(err)))
      await use(errors)
      const real = errors.filter(
        (e) =>
          !e.includes('favicon') &&
          !e.includes('404') &&
          !e.includes('ERR_ABORTED') &&
          // Cloudflare Turnstile widget (sitekey 1x00000000000000000000AA in dev/CI)
          // makes cross-origin requests to challenges.cloudflare.com that return 400.
          // Chromium logs these as "Failed to load resource: the server responded with
          // a status of 400 ()" — the empty parens "()" are the redacted cross-origin
          // URL. First-party /api/* 400s always include the full path in parentheses.
          // The worker-side verifyTurnstile already bypasses verification in dev mode.
          !/status of 400 \(\)/.test(e),
      )
      if (real.length > 0) throw new Error('Console errors: ' + real.join('; '))
    },
    { auto: true },
  ],

  checkA11y: async ({}, use) => {
    await use(async (page) => {
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        // Live color previews render arbitrary merchant-chosen colors; their
        // contrast is the merchant's choice, not a fixed app a11y defect.
        .exclude('[data-color-preview]')
        .analyze()
      const critical = results.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      )
      if (critical.length > 0) {
        throw new Error('A11y violations: ' + critical.map((v) => v.description).join('; '))
      }
    })
  },

  addToCart: async ({}, use) => {
    await use(async (page, productPath?: string) => {
      if (productPath) {
        // Caller supplied a specific product page — go there directly.
        await gotoWithRetry(page, productPath)
        await page.waitForLoadState('networkidle')
      } else {
        // Default: discover a real product from the client-rendered grid so we
        // never land on the home page and look for an add-to-cart button there
        // (the home route has no such button — only product pages do).
        await page.goto('/')
        const firstProductLink = page.locator('a[href^="/product/"]').first()
        const found = await firstProductLink
          .waitFor({ state: 'visible', timeout: 15_000 })
          .then(() => true)
          .catch(() => false)
        if (!found) return // store is genuinely empty — caller's guard handles the skip
        const href = await firstProductLink.getAttribute('href')
        if (!href) return
        await gotoWithRetry(page, href)
        await page.waitForLoadState('networkidle')
      }
      const addBtn = page.getByRole('button', { name: /add to cart/i }).first()
      if (await addBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        // Select the first available (non-disabled) size button before clicking
        // Add to Cart — the button stays disabled until a size is chosen.
        // Size buttons carry aria-pressed; targeting :not([disabled]) skips OOS.
        // SizePicker buttons are inside the container that follows the "Select Size"
        // label. VariantSelector buttons (also aria-pressed) appear before size buttons
        // and have rounded-full; clicking an already-selected variant button resets
        // selectedSizeId → null, keeping Add to Cart disabled. Target size buttons
        // specifically by looking within the SizePicker container (sibling of the label).
        const sizeSectionLabel = page.getByText('Select Size', { exact: true })
        const hasSizeSection = await sizeSectionLabel
          .isVisible({ timeout: 3_000 })
          .catch(() => false)
        if (hasSizeSection) {
          // First enabled button inside the SizePicker container
          const firstSizeBtn = sizeSectionLabel
            .locator('..')
            .locator('button:not([disabled])')
            .first()
          const sizeVisible = await firstSizeBtn.isVisible({ timeout: 3_000 }).catch(() => false)
          if (sizeVisible) {
            await firstSizeBtn.click()
            // Wait for the Add to Cart button to become enabled after React state update.
            await expect(addBtn)
              .toBeEnabled({ timeout: 5_000 })
              .catch(() => null)
          }
        }
        // Only click when enabled — avoids Playwright throwing on disabled button.
        const isEnabled = await addBtn.isEnabled({ timeout: 2_000 }).catch(() => false)
        if (isEnabled) {
          await addBtn.click()
        }
      }
    })
  },
})

export { expect }
