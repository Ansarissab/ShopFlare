// Public order routes — mounted at /api/orders. NO admin endpoints live here;
// admin order management (list/detail/status/tracking/POS) is on the
// CF-Access-protected /api/admin/orders router. Keeping them apart is what lets
// edge Access guard the admin surface without blocking public checkout.

import { Hono } from 'hono'
import type { Context } from 'hono'
import { eq, and, inArray } from 'drizzle-orm'
import { createDb } from 'worker/db/index'
import * as schema from 'worker/db/schema'
import { codOrderSchema, cancelOrderSchema } from '@/lib/schemas'
import { createOrder, assertItemsAvailable, releaseOrderInventory, CouponError, StockError } from 'worker/lib/orders'
import { parseBody } from 'worker/lib/http'
import { verifyTurnstile } from 'worker/lib/turnstile'
import { rateLimit } from 'worker/lib/ratelimit'
import { notifyNewOrder } from 'worker/lib/notify'
import type { Bindings } from 'worker/types'

const app = new Hono<{ Bindings: Bindings }>()

// ─── GET /track/:orderNumber ──────────────────────────────────────────────────

app.get('/track/:orderNumber', async (c) => {
  // Throttle per IP — order numbers are unguessable, but a throttle removes any
  // brute-force enumeration angle on this PII-bearing lookup.
  if (!(await rateLimit(c.env, 'track', c.req.header('CF-Connecting-IP'), { limit: 30, windowSeconds: 60 }))) {
    return c.json({ error: 'Too many requests' }, 429)
  }

  const { orderNumber } = c.req.param()
  const db = createDb(c.env.DB)

  const order = await db
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.orderNumber, orderNumber))
    .get()

  if (!order) return c.json({ error: 'Order not found' }, 404)

  // Best-effort contact verification.
  // If `contact` is provided we verify it matches customerEmail (case-insensitive)
  // or customerPhone (digits-only suffix match). If absent we allow — back-compat
  // with post-checkout redirect links that don't carry a contact param.
  // Note: this is best-effort; orderNumbers are random nanoids so guessing is
  // infeasible. Full hard-gating would require always carrying the contact.
  const contact = c.req.query('contact')
  if (contact) {
    const contactLower = contact.trim().toLowerCase()
    const emailMatch =
      order.customerEmail !== null &&
      order.customerEmail.toLowerCase() === contactLower
    const digitsOnly = (s: string) => s.replace(/\D/g, '')
    const contactDigits = digitsOnly(contact)
    const phoneMatch =
      contactDigits.length > 0 &&
      order.customerPhone !== null &&
      digitsOnly(order.customerPhone).endsWith(contactDigits)

    if (!emailMatch && !phoneMatch) {
      return c.json({ error: 'Contact does not match this order' }, 403)
    }
  }

  const items = await db
    .select()
    .from(schema.orderItems)
    .where(eq(schema.orderItems.orderId, order.id))
    .all()

  const safeItems = items.map((item) => ({
    quantity: item.quantity,
    priceCents: item.priceCents,
    snapshot: (() => {
      try { return JSON.parse(item.snapshot) } catch { return {} }
    })(),
  }))

  return c.json({
    order: {
      orderNumber: order.orderNumber,
      status: order.status,
      paymentMethod: order.paymentMethod,
      customerName: order.customerName,
      subtotalCents: order.subtotalCents,
      shippingCents: order.shippingCents,
      totalCents: order.totalCents,
      trackingNumber: order.trackingNumber ?? undefined,
      carrier: order.carrier ?? undefined,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    },
    items: safeItems,
  })
})

// ─── GET /by-session/:sessionId ───────────────────────────────────────────────
// Used by the frontend success page to build the track link after Stripe checkout.

app.get('/by-session/:sessionId', async (c) => {
  const { sessionId } = c.req.param()
  const db = createDb(c.env.DB)

  const order = await db
    .select({ orderNumber: schema.orders.orderNumber })
    .from(schema.orders)
    .where(eq(schema.orders.stripeSessionId, sessionId))
    .get()

  if (!order) return c.json({ error: 'Order not found' }, 404)

  return c.json({ orderNumber: order.orderNumber })
})

// ─── POST /cod  +  POST /bank-transfer ─────────────────────────────────────────
// Both are "manual" payment paths: no online capture, the order is created
// `pending`, and the merchant confirms it later (COD on delivery, bank transfer
// once the money lands). Identical request shape + flow, so they share one
// handler — only the stored paymentMethod and the rate-limit bucket differ.

function manualOrderHandler(paymentMethod: 'cod' | 'bank_transfer', bucket: string) {
  return async (c: Context<{ Bindings: Bindings }>) => {
    // Security: per-IP throttle, then verify Turnstile token before any DB work.
    const ip = c.req.header('CF-Connecting-IP')
    if (!(await rateLimit(c.env, bucket, ip, { limit: 10, windowSeconds: 60 }))) {
      return c.json({ error: 'Too many requests' }, 429)
    }
    const token = c.req.header('X-Turnstile-Token') ?? null
    const valid = await verifyTurnstile(token, c.env.TURNSTILE_SECRET_KEY, ip, {
      isDevelopment: c.env.ENVIRONMENT === 'development',
    })
    if (!valid) return c.json({ error: 'Security check failed' }, 403)

    const [body, errResp] = await parseBody(c)
    if (errResp) return errResp

    const parsed = codOrderSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 400)
    }

    const { items, shippingAddress, couponCode } = parsed.data
    const db = createDb(c.env.DB)

    try {
      // Verify all sizeOptionIds exist, are active, and have sufficient stock.
      // createOrder then reserves stock atomically; this is the friendly pre-check.
      await assertItemsAvailable(db, items)

      const { orderId, orderNumber } = await createOrder(db, {
        paymentMethod,
        items,
        customerName: shippingAddress.name,
        customerEmail: shippingAddress.email,
        customerPhone: shippingAddress.phone,
        shippingAddress: shippingAddress as Record<string, unknown>,
        couponCode,
      })

      // Fire notifications via waitUntil — never blocks the 201 response.
      // Fresh D1 handle for post-response work (mirrors stripe.ts).
      c.executionCtx.waitUntil(
        notifyNewOrder(createDb(c.env.DB), c.env, orderId, orderNumber),
      )

      return c.json({ orderId, orderNumber }, 201)
    } catch (err) {
      if (err instanceof StockError || err instanceof CouponError) {
        return c.json({ error: err.message }, 422)
      }
      throw err
    }
  }
}

app.post('/cod', manualOrderHandler('cod', 'cod'))
app.post('/bank-transfer', manualOrderHandler('bank_transfer', 'bank-transfer'))

// ─── POST /:orderNumber/cancel ────────────────────────────────────────────────
// Resolves by orderNumber (the only identifier the public has access to).

app.post('/:orderNumber/cancel', async (c) => {
  // Throttle per IP — cancellation is a state-changing action keyed only on the
  // (unguessable) order number, so a throttle blocks any mass-cancel attempt.
  if (!(await rateLimit(c.env, 'cancel', c.req.header('CF-Connecting-IP'), { limit: 10, windowSeconds: 60 }))) {
    return c.json({ error: 'Too many requests' }, 429)
  }

  const { orderNumber } = c.req.param()

  const [body] = await parseBody(c)
  const parsed = cancelOrderSchema.safeParse(body ?? {})
  const reason = parsed.success ? (parsed.data.reason ?? null) : null

  const db = createDb(c.env.DB)

  const order = await db
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.orderNumber, orderNumber))
    .get()

  if (!order) return c.json({ error: 'Order not found' }, 404)

  if (order.status !== 'pending' && order.status !== 'confirmed') {
    return c.json({ error: 'Order cannot be cancelled', status: order.status }, 422)
  }

  // Flip status with a guard on the cancellable states. D1 reports meta.changes:
  // exactly one request wins the transition, so the non-idempotent inventory
  // release (below) runs once even under a concurrent double-cancel.
  const cancelRes = await db
    .update(schema.orders)
    .set({
      status: 'cancelled',
      notes: reason ?? order.notes,
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(schema.orders.id, order.id),
        inArray(schema.orders.status, ['pending', 'confirmed']),
      ),
    )

  if ((cancelRes as unknown as D1Result).meta?.changes === 1) {
    // Return the reserved stock + coupon quota to the pool.
    await releaseOrderInventory(db, order.id)
  }

  return c.json({ ok: true })
})

export default app
