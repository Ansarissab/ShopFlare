import { test, expect } from './fixtures'

/**
 * Smoke tests — one test per static route.
 * Dynamic routes ([slug], [id], [orderId]) are skipped here; covered by feature specs.
 * Admin routes are included — in CI, CF Access is bypassed via service token or the
 * dev server runs without auth. Locally they may redirect; status check uses < 400
 * so 301/302 redirects still pass, but we also check heading on the settled page.
 */

const ROUTES: { path: string; heading: RegExp; needsCart?: boolean }[] = [
  // ── Store ────────────────────────────────────────────────────────────────────
  { path: '/',                    heading: /./i },           // any heading (store name or tagline)
  { path: '/checkout',            heading: /checkout|complete/i, needsCart: true }, // empty cart redirects to home

  { path: '/checkout/success',    heading: /order|success|thank/i },
  { path: '/track',               heading: /track/i },
  { path: '/offline',             heading: /offline|unavailable/i },

  // ── Admin ─────────────────────────────────────────────────────────────────────
  { path: '/admin',               heading: /dashboard|admin|overview/i },
  { path: '/admin/analytics',     heading: /analytic/i },
  { path: '/admin/categories',    heading: /categor/i },
  { path: '/admin/categories/new',heading: /categor|new/i },
  { path: '/admin/coupons',       heading: /coupon/i },
  { path: '/admin/notify',        heading: /notif|restock/i },
  { path: '/admin/orders',        heading: /order/i },
  { path: '/admin/pages',         heading: /page/i },
  { path: '/admin/pos',           heading: /pos|point.of.sale/i },
  { path: '/admin/products',      heading: /product/i },
  { path: '/admin/products/new',  heading: /product|new/i },
  { path: '/admin/reviews',       heading: /review/i },
  { path: '/admin/settings',      heading: /setting/i },
  { path: '/admin/unauthorized',  heading: /unauthorized|access|denied/i },
]

// A minimal valid cart entry so stateful routes (checkout) don't redirect to home.
const SEED_CART = {
  state: {
    items: [{
      sizeOptionId: 's1', productId: 'p1', variantId: 'v1',
      productName: 'Demo', variantLabel: 'Black', size: 'M',
      priceCents: 1000, imageUrl: '', quantity: 1,
    }],
    isOpen: false, couponCode: null, discountCents: 0,
  },
  version: 0,
}

for (const route of ROUTES) {
  test(`@smoke ${route.path} loads`, async ({ page }) => {
    if (route.needsCart) {
      await page.addInitScript((cart) => {
        localStorage.setItem('cart', JSON.stringify(cart))
      }, SEED_CART)
    }
    const response = await page.goto(route.path)
    expect(response?.status()).toBeLessThan(400)
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('heading').first()).toHaveText(route.heading)
  })
}
