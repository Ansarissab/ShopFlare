import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Bindings } from './types'

const app = new Hono<{ Bindings: Bindings }>()

app.use(
  '*',
  cors({
    // Allow the configured FRONTEND_URL plus any localhost origin (dev/preview).
    // We restrict to a single known origin (never '*') so a malicious site can't
    // read admin responses (e.g. the login token) from a victim's browser.
    origin: (origin, c) => {
      // Localhost is always allowed (dev/preview).
      if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
        return origin
      }

      const frontendUrl = c.env.FRONTEND_URL
      if (frontendUrl) return origin === frontendUrl ? origin : null

      // No FRONTEND_URL configured: echo the origin ONLY in local development.
      // In production fail closed — deny cross-origin rather than reflect it.
      if (c.env.ENVIRONMENT === 'development') return origin || null
      return null
    },
    // Admin requests carry the session token in the Authorization (Bearer)
    // header; public POSTs carry X-Turnstile-Token.
    allowHeaders: ['Content-Type', 'X-Turnstile-Token', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
)

// Health check
app.get('/api/ping', (c) => c.json({ ok: true }))

// ─── /cdn/* — serve product images from R2 ────────────────────────────────────
// Admin uploads store their public URL as `${workerOrigin}/cdn/<r2Key>`; this
// route streams the object back. Long-cached (images are content-addressed by
// nanoid, so a new upload yields a new key).
app.get('/cdn/*', async (c) => {
  const key = c.req.path.slice('/cdn/'.length)
  if (!key) return c.notFound()

  const object = await c.env.R2.get(key)
  if (!object) return c.notFound()

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)
  headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  return new Response(object.body, { headers })
})

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
app.route('/api/notify', (await import('./routes/notify')).default)
app.route('/api/push', (await import('./routes/push')).customerPushApp)
app.route('/api/coupons', (await import('./routes/coupons')).default)
app.route('/api/reviews', (await import('./routes/reviews')).default)
app.route('/api/pages', (await import('./routes/pages')).default)
app.route('/api/categories', (await import('./routes/categories')).default)

// Admin API — every sub-route is gated by CF Access JWT verification.
app.route('/api/admin', (await import('./routes/admin/index')).default)

export default app
