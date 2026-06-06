// Integration tests for reviews routes:
//   POST /api/reviews          — verified-purchase submit (Turnstile bypassed in dev)
//   GET  /api/reviews/product/:id — approved reviews + aggregate

import { env, SELF } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { createDb } from 'worker/db/index'
import * as schema from 'worker/db/schema'

const db = () => createDb(env.DB)
const BASE = 'https://shop.test'

const get = (path: string) => SELF.fetch(`${BASE}${path}`)

const post = (path: string, body: unknown) =>
  SELF.fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

// ─── Cleanup ──────────────────────────────────────────────────────────────────

const TABLES = [
  'coupon_uses', 'reviews', 'notify_me', 'order_items', 'orders', 'coupons',
  'size_options', 'product_images', 'variants', 'products', 'store_config',
  'stripe_events', 'push_subscriptions', 'analytics_daily', 'carts',
]
beforeEach(async () => {
  for (const t of TABLES) await env.DB.prepare(`DELETE FROM ${t}`).run()
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function seedProduct() {
  await db().insert(schema.products).values({ id: 'p1', name: 'Demo Tee', active: true })
  await db().insert(schema.variants).values({ id: 'v1', productId: 'p1', label: 'Black', sortOrder: 0 })
  await db().insert(schema.sizeOptions).values({ id: 's1', variantId: 'v1', size: 'M', priceCents: 1000, stock: 5, active: true })
  return { productId: 'p1', variantId: 'v1', sizeId: 's1' }
}

/** Seeds a delivered order for the given product and returns its orderNumber */
async function seedDeliveredOrder(opts: {
  email: string
  productId: string
  orderNumber?: string
}) {
  const { email, productId, orderNumber = 'ORD-TESTDLVR' } = opts
  const orderId = `ord-${Date.now()}`
  const now = new Date().toISOString()

  await db().insert(schema.orders).values({
    id: orderId,
    orderNumber,
    status: 'delivered',
    paymentMethod: 'cod',
    subtotalCents: 1000,
    shippingCents: 0,
    discountCents: 0,
    totalCents: 1000,
    customerName: 'Test User',
    customerEmail: email,
    customerPhone: '+923001234567',
    shippingAddress: '{}',
    createdAt: now,
    updatedAt: now,
  })

  await db().insert(schema.orderItems).values({
    id: `item-${Date.now()}`,
    orderId,
    productId,
    variantId: 'v1',
    sizeOptionId: 's1',
    quantity: 1,
    priceCents: 1000,
    snapshot: JSON.stringify({ productName: 'Demo Tee', variantLabel: 'Black', size: 'M', sku: '', imageUrl: '' }),
  })

  return { orderId, orderNumber }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/reviews', () => {
  it('rejects review when no matching delivered order (403)', async () => {
    await seedProduct()
    const res = await post('/api/reviews', {
      orderNumber: 'ORD-DOESNOTEXIST',
      contact: 'jane@example.com',
      productId: 'p1',
      customerName: 'Jane',
      rating: 5,
    })
    expect(res.status).toBe(403)
  })

  it('rejects review when order exists but is not delivered (403)', async () => {
    await seedProduct()
    const orderId = `ord-pend-${Date.now()}`
    const now = new Date().toISOString()
    await db().insert(schema.orders).values({
      id: orderId,
      orderNumber: 'ORD-PENDING01',
      status: 'pending',
      paymentMethod: 'cod',
      subtotalCents: 1000,
      shippingCents: 0,
      discountCents: 0,
      totalCents: 1000,
      customerName: 'Jane',
      customerEmail: 'jane@example.com',
      customerPhone: '+923001234567',
      shippingAddress: '{}',
      createdAt: now,
      updatedAt: now,
    })

    const res = await post('/api/reviews', {
      orderNumber: 'ORD-PENDING01',
      contact: 'jane@example.com',
      productId: 'p1',
      customerName: 'Jane',
      rating: 5,
    })
    expect(res.status).toBe(403)
  })

  it('rejects review when contact does not match order (403)', async () => {
    await seedProduct()
    await seedDeliveredOrder({ email: 'real@example.com', productId: 'p1', orderNumber: 'ORD-CONTACT01' })

    const res = await post('/api/reviews', {
      orderNumber: 'ORD-CONTACT01',
      contact: 'wrong@example.com',
      productId: 'p1',
      customerName: 'Imposter',
      rating: 4,
    })
    expect(res.status).toBe(403)
  })

  it('rejects review when product was not in the order (403)', async () => {
    await seedProduct()
    await seedDeliveredOrder({ email: 'jane@example.com', productId: 'p1', orderNumber: 'ORD-WRONGPROD' })

    const res = await post('/api/reviews', {
      orderNumber: 'ORD-WRONGPROD',
      contact: 'jane@example.com',
      productId: 'other-product',
      customerName: 'Jane',
      rating: 5,
    })
    expect(res.status).toBe(403)
  })

  it('accepts a valid review for a delivered order (201, pending moderation)', async () => {
    await seedProduct()
    await seedDeliveredOrder({ email: 'jane@example.com', productId: 'p1', orderNumber: 'ORD-VALID001' })

    const res = await post('/api/reviews', {
      orderNumber: 'ORD-VALID001',
      contact: 'jane@example.com',
      productId: 'p1',
      customerName: 'Jane',
      rating: 5,
      body: 'Great tee!',
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as { ok: boolean; pending: boolean }
    expect(body.ok).toBe(true)
    expect(body.pending).toBe(true)

    // Row inserted but not yet approved
    const row = await db()
      .select()
      .from(schema.reviews)
      .where(eq(schema.reviews.productId, 'p1'))
      .get()
    expect(row).toBeDefined()
    expect(row?.approved).toBe(false)
    expect(row?.rating).toBe(5)
  })

  it('accepts contact match by phone number', async () => {
    await seedProduct()
    await seedDeliveredOrder({ email: 'jane@example.com', productId: 'p1', orderNumber: 'ORD-PHONE001' })

    const res = await post('/api/reviews', {
      orderNumber: 'ORD-PHONE001',
      contact: '+923001234567',
      productId: 'p1',
      customerName: 'Jane',
      rating: 4,
    })
    expect(res.status).toBe(201)
  })

  it('rejects duplicate review for same order+product (409)', async () => {
    await seedProduct()
    await seedDeliveredOrder({ email: 'jane@example.com', productId: 'p1', orderNumber: 'ORD-DUP001' })

    await post('/api/reviews', {
      orderNumber: 'ORD-DUP001',
      contact: 'jane@example.com',
      productId: 'p1',
      customerName: 'Jane',
      rating: 5,
    })

    const res2 = await post('/api/reviews', {
      orderNumber: 'ORD-DUP001',
      contact: 'jane@example.com',
      productId: 'p1',
      customerName: 'Jane',
      rating: 3,
    })
    expect(res2.status).toBe(409)
  })

  it('returns 400 on invalid payload (missing required fields)', async () => {
    const res = await post('/api/reviews', { rating: 5 })
    expect(res.status).toBe(400)
  })
})

describe('GET /api/reviews/product/:id', () => {
  it('returns empty list and zero aggregate when no reviews', async () => {
    await seedProduct()
    const res = await get('/api/reviews/product/p1')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { reviews: unknown[]; average: number; count: number }
    expect(body.reviews).toHaveLength(0)
    expect(body.average).toBe(0)
    expect(body.count).toBe(0)
  })

  it('only returns approved reviews', async () => {
    await seedProduct()
    const now = new Date().toISOString()
    const orderId = `ord-apprv-${Date.now()}`

    await db().insert(schema.orders).values({
      id: orderId,
      orderNumber: 'ORD-APPRV001',
      status: 'delivered',
      paymentMethod: 'cod',
      subtotalCents: 1000,
      shippingCents: 0,
      discountCents: 0,
      totalCents: 1000,
      customerName: 'User',
      customerEmail: 'user@example.com',
      customerPhone: '+9230000000',
      shippingAddress: '{}',
      createdAt: now,
      updatedAt: now,
    })

    // Insert one approved and one unapproved review directly
    await db().insert(schema.reviews).values([
      { id: 'r1', orderId, productId: 'p1', customerName: 'Alice', rating: 5, approved: true },
      { id: 'r2', orderId, productId: 'p1', customerName: 'Bob',   rating: 2, approved: false },
    ])

    const res = await get('/api/reviews/product/p1')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { reviews: Array<{ id: string }>; average: number; count: number }
    expect(body.count).toBe(1)
    expect(body.reviews[0].id).toBe('r1')
    expect(body.average).toBe(5)
  })

  it('computes correct average across multiple approved reviews', async () => {
    await seedProduct()
    const now = new Date().toISOString()
    const orderId = `ord-avg-${Date.now()}`

    await db().insert(schema.orders).values({
      id: orderId,
      orderNumber: 'ORD-AVG001',
      status: 'delivered',
      paymentMethod: 'cod',
      subtotalCents: 1000,
      shippingCents: 0,
      discountCents: 0,
      totalCents: 1000,
      customerName: 'User',
      customerEmail: 'avg@example.com',
      customerPhone: '+9230000001',
      shippingAddress: '{}',
      createdAt: now,
      updatedAt: now,
    })

    await db().insert(schema.reviews).values([
      { id: 'r-avg1', orderId, productId: 'p1', customerName: 'Alice', rating: 4, approved: true },
      { id: 'r-avg2', orderId, productId: 'p1', customerName: 'Bob',   rating: 3, approved: true },
      { id: 'r-avg3', orderId, productId: 'p1', customerName: 'Carol', rating: 5, approved: true },
    ])

    const res = await get('/api/reviews/product/p1')
    const body = (await res.json()) as { reviews: unknown[]; average: number; count: number }
    expect(body.count).toBe(3)
    // (4+3+5)/3 = 4
    expect(body.average).toBe(4)
  })

  it('returns empty for an unknown product id', async () => {
    const res = await get('/api/reviews/product/nonexistent')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { reviews: unknown[]; count: number }
    expect(body.reviews).toHaveLength(0)
    expect(body.count).toBe(0)
  })
})
