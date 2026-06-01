import { Hono } from 'hono'
import { eq, and, desc, count, sql } from 'drizzle-orm'
import { z } from 'zod/v4'
import { createDb } from '../db/index'
import * as schema from '../db/schema'
import { codOrderSchema, cancelOrderSchema, updateOrderStatusSchema, updateTrackingSchema } from '@/lib/schemas'
import { createOrder, CouponError } from '../lib/orders'
import { parseBody } from '../lib/http'
import { verifyTurnstile } from '../lib/turnstile'
import type { Bindings } from '../types'

const app = new Hono<{ Bindings: Bindings }>()

// ─── POST /pos — admin: point-of-sale in-person cash order ───────────────────
// No Turnstile — admin-only route protected by CF Access.

const posOrderSchema = z.object({
  items: z.array(
    z.object({ sizeOptionId: z.string().min(1), quantity: z.number().int().positive().max(999) }),
  ).min(1),
  customerPhone: z.string().optional(),
})

app.post('/pos', async (c) => {
  const [body, errResp] = await parseBody(c)
  if (errResp) return errResp

  const parsed = posOrderSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 400)
  }

  const { items, customerPhone } = parsed.data
  const db = createDb(c.env.DB)

  try {
    const { orderId, orderNumber } = await createOrder(db, {
      paymentMethod: 'in_person_cash',
      items,
      customerName: 'In-Person Customer',
      customerPhone,
    })

    return c.json({ orderId, orderNumber }, 201)
  } catch (err) {
    if (err instanceof CouponError) return c.json({ error: err.message }, 422)
    throw err
  }
})

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

// ─── GET / — admin: list all orders (paginated, newest first) ─────────────────

app.get('/', async (c) => {
  const db = createDb(c.env.DB)
  const page  = Math.max(1, Number(c.req.query('page')  ?? '1'))
  const limit = Math.min(100, Math.max(1, Number(c.req.query('limit') ?? '20')))
  const statusFilter = c.req.query('status')

  const offset = (page - 1) * limit

  const baseQuery = db.select().from(schema.orders)
  const countQuery = db.select({ total: count() }).from(schema.orders)

  const [orders, [{ total }]] = await Promise.all([
    (statusFilter
      ? baseQuery.where(eq(schema.orders.status, statusFilter as typeof schema.orders.$inferSelect['status']))
      : baseQuery
    )
      .orderBy(desc(schema.orders.createdAt))
      .limit(limit)
      .offset(offset)
      .all(),
    (statusFilter
      ? countQuery.where(eq(schema.orders.status, statusFilter as typeof schema.orders.$inferSelect['status']))
      : countQuery
    ).all(),
  ])

  return c.json({ orders, total, page, limit })
})

// ─── GET /:id — admin: get order with items + shipping address ────────────────

app.get('/:id', async (c) => {
  const { id } = c.req.param()
  const db = createDb(c.env.DB)

  // Accept both id (UUID) and orderNumber
  const order = await db
    .select()
    .from(schema.orders)
    .where(
      sql`${schema.orders.id} = ${id} OR ${schema.orders.orderNumber} = ${id}`,
    )
    .get()

  if (!order) return c.json({ error: 'Order not found' }, 404)

  const items = await db
    .select()
    .from(schema.orderItems)
    .where(eq(schema.orderItems.orderId, order.id))
    .all()

  const parsedItems = items.map((item) => ({
    ...item,
    snapshot: (() => { try { return JSON.parse(item.snapshot) } catch { return {} } })(),
  }))

  const shippingAddress = order.shippingAddress
    ? (() => { try { return JSON.parse(order.shippingAddress) } catch { return null } })()
    : null

  return c.json({ order, items: parsedItems, shippingAddress })
})

// ─── PATCH /:id/status — admin: update order status ──────────────────────────

app.patch('/:id/status', async (c) => {
  const { id } = c.req.param()
  const [body, errResp] = await parseBody(c)
  if (errResp) return errResp

  const parsed = updateOrderStatusSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 400)
  }

  const { status, notes } = parsed.data
  const db = createDb(c.env.DB)

  const order = await db
    .select({ id: schema.orders.id, status: schema.orders.status })
    .from(schema.orders)
    .where(eq(schema.orders.id, id))
    .get()

  if (!order) return c.json({ error: 'Order not found' }, 404)

  await db
    .update(schema.orders)
    .set({
      status,
      ...(notes !== undefined ? { notes } : {}),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.orders.id, id))

  return c.json({ ok: true, status })
})

// ─── PATCH /:id/tracking — admin: set tracking number ────────────────────────

app.patch('/:id/tracking', async (c) => {
  const { id } = c.req.param()
  const [body, errResp] = await parseBody(c)
  if (errResp) return errResp

  const parsed = updateTrackingSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 400)
  }

  const { trackingNumber, carrier } = parsed.data
  const db = createDb(c.env.DB)

  const order = await db
    .select({ id: schema.orders.id, status: schema.orders.status })
    .from(schema.orders)
    .where(eq(schema.orders.id, id))
    .get()

  if (!order) return c.json({ error: 'Order not found' }, 404)

  // Auto-advance to shipped when tracking is first added
  const newStatus = order.status === 'confirmed' || order.status === 'processing'
    ? 'shipped'
    : order.status

  await db
    .update(schema.orders)
    .set({
      trackingNumber,
      carrier: carrier ?? null,
      status: newStatus,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.orders.id, id))

  return c.json({ ok: true, trackingNumber, carrier, status: newStatus })
})

export default app
