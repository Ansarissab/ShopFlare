import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { createDb } from '../db/index'
import * as schema from '../db/schema'
import { codOrderSchema, cancelOrderSchema } from '@/lib/schemas'
import { createOrder } from '../lib/orders'
import type { Bindings } from '../types'

const app = new Hono<{ Bindings: Bindings }>()

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function parseBody(c: { req: { json(): Promise<unknown> } }): Promise<[unknown, null] | [null, Response]> {
  try {
    return [await c.req.json(), null]
  } catch {
    return [null, new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } })]
  }
}

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

// ─── POST /cod ────────────────────────────────────────────────────────────────

app.post('/cod', async (c) => {
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
})

// ─── POST /:id/cancel ─────────────────────────────────────────────────────────

app.post('/:id/cancel', async (c) => {
  const { id } = c.req.param()

  const [body] = await parseBody(c)
  const parsed = cancelOrderSchema.safeParse(body ?? {})
  const reason = parsed.success ? (parsed.data.reason ?? null) : null

  const db = createDb(c.env.DB)

  const order = await db
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.id, id))
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
    .where(eq(schema.orders.id, id))

  return c.json({ ok: true })
})

// ─── Admin stubs (Phase 2) ────────────────────────────────────────────────────

app.get('/', (c) => c.json({ todo: 'list orders — Phase 2' }))
app.get('/:id', (c) => c.json({ todo: 'get order — Phase 2' }))
app.patch('/:id/status', (c) => c.json({ todo: 'update status — Phase 2' }))
app.patch('/:id/tracking', (c) => c.json({ todo: 'add tracking number — Phase 2' }))

export default app
