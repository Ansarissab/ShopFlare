import { test as base } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

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
        (e) => !e.includes('favicon') && !e.includes('404') && !e.includes('ERR_ABORTED'),
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
    await use(async (page, productPath = '/') => {
      await page.goto(productPath)
      await page.waitForLoadState('networkidle')
      const addBtn = page.getByRole('button', { name: /add to cart/i }).first()
      if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await addBtn.click()
      }
    })
  },
})

export { expect } from '@playwright/test'
