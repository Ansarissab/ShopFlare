import { test as base, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { gotoReady } from './helpers'

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
          // Transient local dev-backend connection drops under load (browser
          // ERR_* / undici "fetch failed" / SSR [fetchFromWorker]) — not app
          // defects; routes pass in isolation. The Suspense "switched to client
          // rendering" message is React's downstream fallback when one of those
          // SSR fetches drops mid-stream, so it's the same transient class.
          !/ERR_ABORTED|ERR_FAILED|ERR_CONNECTION|ECONNRESET|fetch failed|Connection closed|\[fetchFromWorker\]|could not finish this Suspense boundary|Switched to client rendering/.test(
            e,
          ) &&
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
      // Retry the scan: a client redirect/RSC commit can destroy axe's execution
      // context mid-scan. Retrying runs it against the final, stable document.
      let results!: Awaited<ReturnType<AxeBuilder['analyze']>>
      await expect(async () => {
        // Freeze entrance animations (e.g. the .pg-enter @starting-style stagger)
        // so axe measures final colours, not a mid-fade frame where the
        // semi-transparent product-card text trips the contrast check.
        await page.addStyleTag({
          content:
            '*,*::before,*::after{transition:none !important;animation:none !important}.pg-enter{opacity:1 !important;transform:none !important}',
        })
        results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa'])
          // Live color previews render arbitrary merchant-chosen colors; their
          // contrast is the merchant's choice, not a fixed app a11y defect.
          .exclude('[data-color-preview]')
          .analyze()
      }).toPass({ timeout: 20_000, intervals: [250, 500, 1000] })

      const critical = results.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      )
      if (critical.length > 0) {
        const detail = critical
          .map(
            (v) =>
              `${v.id}: ${v.description}\n` +
              v.nodes
                .map(
                  (n) =>
                    `    ${n.target.join(' ')}\n      ${n.html}\n      ${JSON.stringify(
                      n.any?.[0]?.data ?? {},
                    )}`,
                )
                .join('\n'),
          )
          .join('\n')
        throw new Error('A11y violations:\n' + detail)
      }
    })
  },

  addToCart: async ({}, use) => {
    await use(async (page, productPath?: string) => {
      if (productPath) {
        // Caller supplied a specific product page — go there directly.
        await gotoReady(page, productPath)
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
        await gotoReady(page, href)
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
