import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Bindings } from './types'

const app = new Hono<{ Bindings: Bindings }>()

app.use(
  '*',
  cors({
    // Allow the configured FRONTEND_URL plus any localhost origin (dev/preview).
    // Echoes the request origin when FRONTEND_URL is unset (local wrangler dev).
    // Never '*': admin requests send the CF Access cookie (credentials), which
    // browsers reject against a wildcard origin.
    origin: (origin, c) => {
      const frontendUrl = c.env.FRONTEND_URL
      if (!frontendUrl) return origin || '*'
      if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
        return origin
      }
      return origin === frontendUrl ? origin : null
    },
    // Send the Access assertion header / CF_Authorization cookie through to the
    // worker so requireAccess can verify it.
    credentials: true,
    allowHeaders: ['Content-Type', 'X-Turnstile-Token', 'Cf-Access-Jwt-Assertion'],
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
app.route('/api/coupons', (await import('./routes/coupons')).default)
app.route('/api/reviews', (await import('./routes/reviews')).default)

// Admin API — every sub-route is gated by CF Access JWT verification.
app.route('/api/admin', (await import('./routes/admin/index')).default)

export default app
