import { test } from './fixtures'
import { gotoReady } from './helpers'

const ROUTES = [
  // Store
  '/',
  '/checkout',
  '/checkout/success',
  '/track',
  // Admin (static)
  '/admin',
  '/admin/analytics',
  '/admin/categories',
  '/admin/categories/new',
  '/admin/coupons',
  '/admin/notify',
  '/admin/orders',
  '/admin/pages',
  '/admin/pos',
  '/admin/products',
  '/admin/products/new',
  '/admin/reviews',
  '/admin/settings',
  '/admin/unauthorized',
  // Other
  '/offline',
]

for (const route of ROUTES) {
  test('a11y: ' + route, async ({ page, checkA11y }) => {
    await gotoReady(page, route)
    // Best-effort wait for content before scanning (some routes have no heading).
    await page
      .getByRole('heading')
      .first()
      .waitFor({ state: 'visible', timeout: 15_000 })
      .catch(() => {})
    await checkA11y(page)
  })
}
