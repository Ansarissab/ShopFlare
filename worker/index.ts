import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Bindings } from './types'

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', cors({ origin: '*' }))

// Health check
app.get('/api/ping', (c) => c.json({ ok: true }))

// Public config (safe keys only — served to client)
app.get('/api/public-config', async (c) => {
  return c.json({
    stripePublishableKey: c.env.STRIPE_PUBLISHABLE_KEY ?? '',
    turnstileSiteKey: c.env.TURNSTILE_SITE_KEY ?? '',
    vapidPublicKey: c.env.VAPID_PUBLIC_KEY ?? '',
  })
})

// Route stubs — implemented in later phases
app.route('/api/stripe', (await import('./routes/stripe')).default)
app.route('/api/products', (await import('./routes/products')).default)
app.route('/api/orders', (await import('./routes/orders')).default)
app.route('/api/config', (await import('./routes/config')).default)
app.route('/api/push', (await import('./routes/push')).default)
app.route('/api/notify', (await import('./routes/notify')).default)

export default app
