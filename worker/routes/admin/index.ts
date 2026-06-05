// Admin API aggregator — every route here is gated by requireAccess, so the
// admin surface lives on a single protected prefix (/api/admin/*). This is what
// lets edge CF Access protect admin endpoints without touching the public
// /api/orders, /api/products, /api/config routers that checkout depends on.

import { Hono } from 'hono'
import { requireAccess } from 'worker/lib/access'
import type { AdminEnv } from 'worker/lib/access'
import orders from './orders'
import products from './products'
import categories from './categories'
import config from './config'
import coupons from './coupons'
import reviews from './reviews'
import notify from './notify'
import pages from './pages'
import analytics from './analytics'
import push from 'worker/routes/push'

const app = new Hono<AdminEnv>()

// CF Access JWT verification on every admin request (defense-in-depth).
app.use('*', requireAccess)

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
// Push subscription mgmt is merchant-only (order alerts to merchant devices),
// so it lives behind CF Access here — not on the public /api router.
app.route('/push', push)

export default app
