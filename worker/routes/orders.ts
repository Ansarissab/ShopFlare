import { Hono } from 'hono'
import { z } from 'zod/v4'
import { eq, and } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { createDb } from '../db/index'
import * as schema from '../db/schema'
import { codOrderSchema } from '@/lib/schemas'

type Bindings = {
  DB: D1Database
  KV: KVNamespace
  R2: R2Bucket
  STRIPE_SECRET_KEY: string
  STRIPE_WEBHOOK_SECRET: string
  RESEND_API_KEY: string
  VAPID_PRIVATE_KEY: string
  VAPID_PUBLIC_KEY: string
}

const app = new Hono<{ Bindings: Bindings }>()

const cancelSchema = z.object({
  reason: z.string().max(500).optional(),
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateOrderNumber(): string {
  return `ORD-${nanoid(6).toUpperCase()}`
}

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

  // Verify all sizeOptionIds exist and have sufficient stock
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

  // Calculate subtotal
  let subtotalCents = 0
  const orderItemsToInsert: typeof schema.orderItems.$inferInsert[] = []

  for (const item of items) {
    const sizeOpt = await db
      .select()
      .from(schema.sizeOptions)
      .where(eq(schema.sizeOptions.id, item.sizeOptionId))
      .get()

    if (!sizeOpt) continue

    const variant = await db
      .select()
      .from(schema.variants)
      .where(eq(schema.variants.id, sizeOpt.variantId))
      .get()

    const product = variant
      ? await db.select().from(schema.products).where(eq(schema.products.id, variant.productId)).get()
      : null

    const firstImage = await db
      .select()
      .from(schema.productImages)
      .where(eq(schema.productImages.variantId, sizeOpt.variantId))
      .get()

    subtotalCents += sizeOpt.priceCents * item.quantity

    orderItemsToInsert.push({
      id: nanoid(),
      orderId: '',  // filled in below after order insert
      sizeOptionId: item.sizeOptionId,
      productId: product?.id ?? '',
      variantId: sizeOpt.variantId,
      quantity: item.quantity,
      priceCents: sizeOpt.priceCents,
      snapshot: JSON.stringify({
        productName: product?.name ?? '',
        variantLabel: variant?.label ?? '',
        size: sizeOpt.size,
        sku: sizeOpt.sku ?? undefined,
        imageUrl: firstImage?.url ?? '',
      }),
    })
  }

  // Coupon discount
  let discountCents = 0
  if (couponCode) {
    const coupon = await db
      .select()
      .from(schema.coupons)
      .where(and(eq(schema.coupons.code, couponCode), eq(schema.coupons.active, true)))
      .get()

    if (coupon) {
      if (coupon.type === 'percentage') {
        discountCents = Math.floor(subtotalCents * coupon.value / 100)
      } else {
        discountCents = coupon.value
      }
      if (coupon.maxDiscountCents) {
        discountCents = Math.min(discountCents, coupon.maxDiscountCents)
      }
    }
  }

  const totalCents = Math.max(0, subtotalCents - discountCents)
  const orderId = nanoid()
  const orderNumber = generateOrderNumber()

  await db.insert(schema.orders).values({
    id: orderId,
    orderNumber,
    status: 'pending',
    paymentMethod: 'cod',
    customerName: shippingAddress.name,
    customerEmail: shippingAddress.email ?? null,
    customerPhone: shippingAddress.phone,
    shippingAddress: JSON.stringify(shippingAddress),
    subtotalCents,
    shippingCents: 0,
    discountCents,
    totalCents,
    couponCode: couponCode ?? null,
  })

  // Insert order items
  for (const item of orderItemsToInsert) {
    await db.insert(schema.orderItems).values({ ...item, orderId })
  }

  return c.json({ orderId, orderNumber }, 201)
})

// ─── POST /:id/cancel ─────────────────────────────────────────────────────────

app.post('/:id/cancel', async (c) => {
  const { id } = c.req.param()

  const [body] = await parseBody(c)
  const parsed = cancelSchema.safeParse(body ?? {})
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
