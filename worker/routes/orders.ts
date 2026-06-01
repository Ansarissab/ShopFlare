import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { createDb } from '../db/index'
import * as schema from '../db/schema'
import { codOrderSchema, cancelOrderSchema } from '@/lib/schemas'
import { createOrder, CouponError } from '../lib/orders'
import { parseBody } from '../lib/http'
import { verifyTurnstile } from '../lib/turnstile'
import type { Bindings } from '../types'

const app = new Hono<{ Bindings: Bindings }>()

// ─── GET /track/:orderNumber ──────────────────────────────────────────────────

app.get('/track/:orderNumber', async (c) => {
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

// ─── POST /cod ────────────────────────────────────────────────────────────────

app.post('/cod', async (c) => {
  // Security: verify Turnstile token before any DB work
  const token = c.req.header('X-Turnstile-Token') ?? null
  const valid = await verifyTurnstile(token, c.env.TURNSTILE_SECRET_KEY, c.req.header('CF-Connecting-IP'))
  if (!valid) return c.json({ error: 'Security check failed' }, 403)

  const [body, errResp] = await parseBody(c)
  if (errResp) return errResp

  const parsed = codOrderSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 400)
  }

  const { items, shippingAddress, couponCode } = parsed.data
  const db = createDb(c.env.DB)

  // Verify all sizeOptionIds exist and have sufficient stock (COD only —
  // Stripe relies on its own inventory controls)
  for (const item of items) {
    const sizeOpt = await db
      .select()
      .from(schema.sizeOptions)
      .where(and(eq(schema.sizeOptions.id, item.sizeOptionId), eq(schema.sizeOptions.active, true)))
      .get()

    if (!sizeOpt) {
      return c.json({ error: `Size option not found: ${item.sizeOptionId}` }, 422)
    }
    if (sizeOpt.stock !== -1 && sizeOpt.stock < item.quantity) {
      return c.json({ error: `Insufficient stock for size: ${sizeOpt.size}` }, 422)
    }
  }

  try {
    const { orderId, orderNumber } = await createOrder(db, {
      paymentMethod: 'cod',
      items,
      customerName: shippingAddress.name,
      customerEmail: shippingAddress.email,
      customerPhone: shippingAddress.phone,
      shippingAddress: shippingAddress as Record<string, unknown>,
      couponCode,
    })

    return c.json({ orderId, orderNumber }, 201)
  } catch (err) {
    if (err instanceof CouponError) {
      return c.json({ error: err.message }, 422)
    }
    throw err
  }
})

// ─── POST /:orderNumber/cancel ────────────────────────────────────────────────
// Resolves by orderNumber (the only identifier the public has access to).

app.post('/:orderNumber/cancel', async (c) => {
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

  await db
    .update(schema.orders)
    .set({
      status: 'cancelled',
      notes: reason ?? order.notes,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.orders.id, order.id))

  return c.json({ ok: true })
})

// ─── Admin stubs (Phase 2) ────────────────────────────────────────────────────

app.get('/', (c) => c.json({ todo: 'list orders — Phase 2' }))
app.get('/:id', (c) => c.json({ todo: 'get order — Phase 2' }))
app.patch('/:id/status', (c) => c.json({ todo: 'update status — Phase 2' }))
app.patch('/:id/tracking', (c) => c.json({ todo: 'add tracking number — Phase 2' }))

export default app
