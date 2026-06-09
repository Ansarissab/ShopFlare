// Admin API aggregator — every route here (except /login) is gated by
// requireAdmin, so the admin surface lives on a single protected prefix
// (/api/admin/*), separate from the public /api/orders, /api/products,
// /api/config routers that checkout depends on.

import { Hono } from 'hono'
import { requireAdmin } from 'worker/lib/access'
import type { AdminEnv } from 'worker/lib/access'
import login from './login'
import orders from './orders'
import products from './products'
import categories from './categories'
import config from './config'
import coupons from './coupons'
import reviews from './reviews'
import notify from './notify'
import pages from './pages'
import analytics from './analytics'
import landing from './landing'
import push from 'worker/routes/push'

const app = new Hono<AdminEnv>()

// Public: login issues the session token (Turnstile-protected). Registered
// BEFORE requireAdmin so it stays exempt — otherwise no one could obtain a token.
app.route('/login', login)

// Session-token verification on every other admin request.
app.use('*', requireAdmin)

// Ensure no admin response is ever stored by a browser or intermediate cache.
app.use('*', async (c, next) => {
  await next()
  c.res.headers.set('Cache-Control', 'no-store')
})

app.route('/orders', orders)
app.route('/products', products)
app.route('/categories', categories)
app.route('/config', config)
app.route('/coupons', coupons)
app.route('/reviews', reviews)
app.route('/notify', notify)
app.route('/pages', pages)
app.route('/analytics', analytics)
app.route('/landing', landing)
// Push subscription mgmt is merchant-only (order alerts to merchant devices),
// so it lives behind CF Access here — not on the public /api router.
app.route('/push', push)

export default app
