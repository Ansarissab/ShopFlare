// Admin order routes — mounted under /api/admin/orders, behind requireAdmin.
// List/detail expose full customer PII and mutate order state, so they MUST
// stay on the protected /api/admin prefix (never the public /api/orders router).

import { Hono } from 'hono'
import { eq, desc, count, sql } from 'drizzle-orm'
import { createDb } from 'worker/db/index'
import * as schema from 'worker/db/schema'
import { updateOrderStatusSchema, updateTrackingSchema } from '@/lib/schemas'
import { createOrder, assertItemsAvailable, CouponError, StockError } from 'worker/lib/orders'
import { parseBody } from 'worker/lib/http'
import { posOrderSchema } from '@/lib/schemas'
import type { AdminEnv } from 'worker/lib/access'
import { notifyOrderStatusChange } from 'worker/lib/notify'

const app = new Hono<AdminEnv>()

// Resolve an order by UUID or orderNumber (admin links use either).
const byIdOrNumber = (id: string) =>
  sql`${schema.orders.id} = ${id} OR ${schema.orders.orderNumber} = ${id}`

// ─── POST /pos — in-person cash order ────────────────────────────────────────

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
    await assertItemsAvailable(db, items)
    const { orderId, orderNumber } = await createOrder(db, {
      paymentMethod: 'in_person_cash',
      items,
      customerName: 'In-Person Customer',
      customerPhone,
    })
    return c.json({ orderId, orderNumber }, 201)
  } catch (err) {
    if (err instanceof StockError || err instanceof CouponError) {
      return c.json({ error: err.message }, 422)
    }
    throw err
  }
})

// ─── GET / — list all orders (paginated, newest first) ───────────────────────

app.get('/', async (c) => {
  const db = createDb(c.env.DB)
  const page = Math.max(1, Number(c.req.query('page') ?? '1'))
  const limit = Math.min(100, Math.max(1, Number(c.req.query('limit') ?? '20')))
  const statusFilter = c.req.query('status')
  const offset = (page - 1) * limit

  const baseQuery = db.select().from(schema.orders)
  const countQuery = db.select({ total: count() }).from(schema.orders)
  const status = statusFilter as typeof schema.orders.$inferSelect['status']

  const [orders, [{ total }]] = await Promise.all([
    (statusFilter ? baseQuery.where(eq(schema.orders.status, status)) : baseQuery)
      .orderBy(desc(schema.orders.createdAt))
      .limit(limit)
      .offset(offset)
      .all(),
    (statusFilter ? countQuery.where(eq(schema.orders.status, status)) : countQuery).all(),
  ])

  return c.json({ orders, total, page, limit })
})

// ─── GET /:id — order detail with items + shipping address ───────────────────

app.get('/:id', async (c) => {
  const { id } = c.req.param()
  const db = createDb(c.env.DB)

  const order = await db.select().from(schema.orders).where(byIdOrNumber(id)).get()
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
    ? (() => { try { return JSON.parse(order.shippingAddress!) } catch { return null } })()
    : null

  return c.json({ order, items: parsedItems, shippingAddress })
})

// ─── PATCH /:id/status ───────────────────────────────────────────────────────

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
    .select({ id: schema.orders.id, orderNumber: schema.orders.orderNumber })
    .from(schema.orders)
    .where(byIdOrNumber(id))
    .get()
  if (!order) return c.json({ error: 'Order not found' }, 404)

  await db
    .update(schema.orders)
    .set({
      status,
      ...(notes !== undefined ? { notes } : {}),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.orders.id, order.id))

  // Notify customer via push when status reaches shipped/delivered
  c.executionCtx?.waitUntil(
    notifyOrderStatusChange(db, c.env, order.orderNumber, status),
  )

  return c.json({ ok: true, status })
})

// ─── PATCH /:id/tracking ─────────────────────────────────────────────────────

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
    .where(byIdOrNumber(id))
    .get()
  if (!order) return c.json({ error: 'Order not found' }, 404)

  // Auto-advance to shipped when tracking is first added.
  const newStatus =
    order.status === 'confirmed' || order.status === 'processing' ? 'shipped' : order.status

  await db
    .update(schema.orders)
    .set({
      trackingNumber,
      carrier: carrier ?? null,
      status: newStatus,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.orders.id, order.id))

  return c.json({ ok: true, trackingNumber, carrier, status: newStatus })
})

export default app
