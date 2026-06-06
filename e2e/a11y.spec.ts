import { test } from './fixtures'

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
    await page.goto(route)
    await page.waitForLoadState('networkidle')
    await checkA11y(page)
  })
}
