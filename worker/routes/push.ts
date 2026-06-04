// Push subscription management — mounted at /api/admin/push, behind CF Access
// (requireAccess on the admin router). These are MERCHANT-only: order-alert
// subscriptions for the merchant's own devices, so they must not live on the
// public /api router.
//
// POST /subscribe  — save or update a PushSubscription (endpoint/auth/p256dh).
//                   Idempotent: uses onConflictDoUpdate to handle re-subscription
//                   with the same endpoint (auth/p256dh may rotate on browser reset).
//
// POST /unsubscribe — delete a subscription by endpoint.
//
// POST /send       — admin trigger: sends a tickle to all stored subscriptions.
//                   Gated by CF Access via the parent admin router.

import { Hono } from 'hono'
import { nanoid } from 'nanoid'
import { eq } from 'drizzle-orm'
import { createDb } from 'worker/db/index'
import * as schema from 'worker/db/schema'
import { parseBody } from 'worker/lib/http'
import { sendPushToAll } from 'worker/lib/push'
import {
  pushSubscriptionSchema,
  pushUnsubscribeSchema,
  pushSendSchema,
  customerPushSubscriptionSchema,
  customerPushUnsubscribeSchema,
} from '@/lib/schemas'
import type { AdminEnv } from 'worker/lib/access'
import type { Bindings } from 'worker/types'
import { en } from '@/lib/i18n/en'
import { verifyTurnstile } from 'worker/lib/turnstile'
import { rateLimit } from 'worker/lib/ratelimit'

const app = new Hono<AdminEnv>()

// ─── POST /subscribe ──────────────────────────────────────────────────────────

app.post('/subscribe', async (c) => {
  const [body, errResp] = await parseBody(c)
  if (errResp) return errResp

  const parsed = pushSubscriptionSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 400)
  }

  const { endpoint, auth, p256dh } = parsed.data

  const db = createDb(c.env.DB)

  await db
    .insert(schema.pushSubscriptions)
    .values({ id: nanoid(), endpoint, auth, p256dh })
    .onConflictDoUpdate({
      target: schema.pushSubscriptions.endpoint,
      set: { auth, p256dh },
    })

  return c.json({ ok: true }, 201)
})

// ─── POST /unsubscribe ────────────────────────────────────────────────────────

app.post('/unsubscribe', async (c) => {
  const [body, errResp] = await parseBody(c)
  if (errResp) return errResp

  const parsed = pushUnsubscribeSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 400)
  }

  const { endpoint } = parsed.data
  const db = createDb(c.env.DB)

  await db
    .delete(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.endpoint, endpoint))

  return c.json({ ok: true })
})

// ─── POST /send ───────────────────────────────────────────────────────────────
// Admin test/trigger endpoint. Access control is intentionally loose for local
// dev; production callers go through CF Access-gated admin UI.

app.post('/send', async (c) => {
  const [body, errResp] = await parseBody(c)
  if (errResp) return errResp

  // Body is optional — an empty trigger sends a generic "new order" tickle.
  const parsed = pushSendSchema.safeParse(body ?? {})
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 400)
  }

  const db = createDb(c.env.DB)
  const count = await sendPushToAll(db, c.env, {
    title: parsed.data.title || en.notifications.newOrderTitle,
    body: parsed.data.body ?? '',
    url: parsed.data.url,
  })

  return c.json({ ok: true, sent: count })
})

export default app

// ─── Public customer push routes ──────────────────────────────────────────────
// Mounted at /api/push (no CF Access required). Turnstile + rate-limit gated.
//
// POST /subscribe   — register a customer PushSubscription tied to an orderNumber
// POST /unsubscribe — remove a customer PushSubscription by endpoint

const customerApp = new Hono<{ Bindings: Bindings }>()

// ─── POST /subscribe ──────────────────────────────────────────────────────────

customerApp.post('/subscribe', async (c) => {
  const ip = c.req.header('CF-Connecting-IP')
  if (!(await rateLimit(c.env, 'customer-push', ip, { limit: 10, windowSeconds: 60 }))) {
    return c.json({ error: 'Too many requests' }, 429)
  }

  const token = c.req.header('X-Turnstile-Token') ?? null
  const valid = await verifyTurnstile(token, c.env.TURNSTILE_SECRET_KEY, ip ?? undefined, {
    isDevelopment: c.env.ENVIRONMENT === 'development',
  })
  if (!valid) return c.json({ error: 'Security check failed' }, 403)

  const [body, errResp] = await parseBody(c)
  if (errResp) return errResp

  const parsed = customerPushSubscriptionSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 400)
  }

  const { endpoint, auth, p256dh, orderNumber } = parsed.data
  const db = createDb(c.env.DB)

  // Verify the order exists before creating a subscription — prevents
  // subscribing to non-existent or guessed order numbers.
  const orderExists = await db
    .select({ id: schema.orders.id })
    .from(schema.orders)
    .where(eq(schema.orders.orderNumber, orderNumber))
    .get()

  if (!orderExists) {
    // Return 422 rather than 404 to avoid confirming whether an order number exists.
    return c.json({ error: 'Invalid subscription request' }, 422)
  }

  await db
    .insert(schema.customerPushSubscriptions)
    .values({ id: nanoid(), endpoint, auth, p256dh, orderNumber, kind: 'order' })
    .onConflictDoUpdate({
      target: schema.customerPushSubscriptions.endpoint,
      set: { auth, p256dh, orderNumber },
    })

  return c.json({ ok: true }, 201)
})

// ─── POST /unsubscribe ────────────────────────────────────────────────────────

customerApp.post('/unsubscribe', async (c) => {
  const [body, errResp] = await parseBody(c)
  if (errResp) return errResp

  const parsed = customerPushUnsubscribeSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 400)
  }

  const { endpoint } = parsed.data
  const db = createDb(c.env.DB)

  await db
    .delete(schema.customerPushSubscriptions)
    .where(eq(schema.customerPushSubscriptions.endpoint, endpoint))

  return c.json({ ok: true })
})

export { customerApp as customerPushApp }
