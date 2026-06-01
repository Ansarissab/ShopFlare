// Admin API aggregator — every route here is gated by requireAccess, so the
// admin surface lives on a single protected prefix (/api/admin/*). This is what
// lets edge CF Access protect admin endpoints without touching the public
// /api/orders, /api/products, /api/config routers that checkout depends on.

import { Hono } from 'hono'
import { requireAccess } from '../../lib/access'
import type { AdminEnv } from '../../lib/access'
import orders from './orders'
import products from './products'
import config from './config'

const app = new Hono<AdminEnv>()

// CF Access JWT verification on every admin request (defense-in-depth).
app.use('*', requireAccess)

app.route('/orders', orders)
app.route('/products', products)
app.route('/config', config)

export default app
