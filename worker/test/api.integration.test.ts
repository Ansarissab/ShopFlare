// End-to-end integration tests — the REAL worker running in workerd with a real
// (ephemeral) D1, KV and R2 via miniflare. Requests go through SELF.fetch, so
// routing, middleware, validation, DB writes and the order/stock/coupon logic
// are all exercised exactly as in production. ENVIRONMENT=development makes the
// Turnstile + CF Access checks bypass (see vitest.integration.config.ts).

import { env, SELF } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { createDb } from 'worker/db/index'
import * as schema from 'worker/db/schema'

const db = () => createDb(env.DB)
const BASE = 'https://shop.test'
const post = (path: string, body: unknown) =>
  SELF.fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
const get = (path: string) => SELF.fetch(`${BASE}${path}`)

const ADDRESS = {
  name: 'Jane Doe',
  phone: '+923001234567',
  email: 'jane@example.com',
  address: '12 Market Road',
  city: 'Karachi',
  country: 'PK',
}

// Seed one active product -> variant -> size option. Returns the ids.
async function seedProduct(opts: { stock?: number; priceCents?: number; active?: boolean } = {}) {
  const { stock = 5, priceCents = 1000, active = true } = opts
  await db().insert(schema.products).values({ id: 'p1', name: 'Demo Tee', active })
  await db().insert(schema.variants).values({ id: 'v1', productId: 'p1', label: 'Black', sortOrder: 0 })
  await db().insert(schema.sizeOptions).values({ id: 's1', variantId: 'v1', size: 'M', priceCents, stock, active: true })
  return { productId: 'p1', variantId: 'v1', sizeId: 's1' }
}

const stockOf = async (id: string) =>
  (await db().select({ stock: schema.sizeOptions.stock }).from(schema.sizeOptions).where(eq(schema.sizeOptions.id, id)).get())?.stock

// Tables cleared between tests (defensive — storage is also isolated per test).
const TABLES = [
  'coupon_uses', 'reviews', 'notify_me', 'order_items', 'orders', 'coupons',
  'size_options', 'product_images', 'variants', 'products', 'store_config',
  'stripe_events', 'push_subscriptions', 'analytics_daily', 'carts',
]
beforeEach(async () => {
  for (const t of TABLES) await env.DB.prepare(`DELETE FROM ${t}`).run()
})

describe('health + public config', () => {
  it('GET /api/ping -> ok', async () => {
    const res = await get('/api/ping')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('GET /api/public-config -> safe keys only', async () => {
    const res = await get('/api/public-config')
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, string>
    expect(body).toHaveProperty('stripePublishableKey')
    expect(body).toHaveProperty('turnstileSiteKey')
    expect(body).toHaveProperty('vapidPublicKey')
  })
})

describe('products', () => {
  it('lists only active products', async () => {
    await seedProduct({ active: true })
    await db().insert(schema.products).values({ id: 'p2', name: 'Hidden', active: false })

    const res = await get('/api/products')
    expect(res.status).toBe(200)
    const { products } = (await res.json()) as { products: Array<{ product: { id: string } }> }
    expect(products.map((p) => p.product.id)).toEqual(['p1'])
  })

  it('404s an inactive product by id', async () => {
    await db().insert(schema.products).values({ id: 'p2', name: 'Hidden', active: false })
    expect((await get('/api/products/p2')).status).toBe(404)
  })
})

describe('COD checkout', () => {
  it('places an order, decrements stock, and is trackable', async () => {
    await seedProduct({ stock: 5, priceCents: 1000 })

    const res = await post('/api/orders/cod', {
      items: [{ sizeOptionId: 's1', quantity: 2 }],
      shippingAddress: ADDRESS,
    })
    expect(res.status).toBe(201)
    const { orderNumber } = (await res.json()) as { orderNumber: string }
    expect(orderNumber).toMatch(/^ORD-[A-Z0-9]{8}$/)

    expect(await stockOf('s1')).toBe(3)

    const track = await get(`/api/orders/track/${orderNumber}`)
    expect(track.status).toBe(200)
    const { order } = (await track.json()) as { order: { totalCents: number; status: string; paymentMethod: string } }
    expect(order).toMatchObject({ totalCents: 2000, status: 'pending', paymentMethod: 'cod' })
  })

  it('rejects quantity above available stock (422)', async () => {
    await seedProduct({ stock: 1 })
    const res = await post('/api/orders/cod', {
      items: [{ sizeOptionId: 's1', quantity: 5 }],
      shippingAddress: ADDRESS,
    })
    expect(res.status).toBe(422)
    expect(await stockOf('s1')).toBe(1)
  })

  it('does not oversell under concurrent orders for the last unit', async () => {
    await seedProduct({ stock: 1, priceCents: 1000 })
    const body = { items: [{ sizeOptionId: 's1', quantity: 1 }], shippingAddress: ADDRESS }

    const [a, b] = await Promise.all([post('/api/orders/cod', body), post('/api/orders/cod', body)])
    const statuses = [a.status, b.status].sort()
    expect(statuses).toEqual([201, 422]) // exactly one wins
    expect(await stockOf('s1')).toBe(0)  // never negative, never double-sold
  })
})

describe('bank transfer', () => {
  it('exposes configured bank details publicly', async () => {
    await db().insert(schema.storeConfig).values([
      { key: 'bankName', value: 'Demo Bank' },
      { key: 'bankAccountNumber', value: '0000-1234567-8' },
    ])
    const res = await get('/api/config/store')
    const cfg = (await res.json()) as Record<string, string>
    expect(cfg.bankName).toBe('Demo Bank')
    expect(cfg.bankAccountNumber).toBe('0000-1234567-8')
  })

  it('places a pending bank_transfer order (no payment capture)', async () => {
    await seedProduct({ stock: 5, priceCents: 1500 })
    const res = await post('/api/orders/bank-transfer', {
      items: [{ sizeOptionId: 's1', quantity: 1 }],
      shippingAddress: ADDRESS,
    })
    expect(res.status).toBe(201)
    const { orderNumber } = (await res.json()) as { orderNumber: string }

    const { order } = (await (await get(`/api/orders/track/${orderNumber}`)).json()) as {
      order: { status: string; paymentMethod: string; totalCents: number }
    }
    expect(order).toMatchObject({ status: 'pending', paymentMethod: 'bank_transfer', totalCents: 1500 })
  })
})

describe('coupons', () => {
  it('validates an active coupon and computes the discount', async () => {
    await db().insert(schema.coupons).values({
      id: 'c1', code: 'WELCOME10', type: 'percentage', value: 10,
      perCustomerLimit: 1, usedCount: 0, active: true,
    })
    const ok = await post('/api/coupons/validate', { code: 'WELCOME10', subtotalCents: 1000 })
    expect(await ok.json()).toMatchObject({ valid: true, discountCents: 100 })

    const bad = await post('/api/coupons/validate', { code: 'NOPE', subtotalCents: 1000 })
    expect(await bad.json()).toMatchObject({ valid: false })
  })
})

describe('cancellation', () => {
  it('cancels a pending order and restores stock', async () => {
    await seedProduct({ stock: 5, priceCents: 1000 })
    const { orderNumber } = (await (
      await post('/api/orders/cod', { items: [{ sizeOptionId: 's1', quantity: 2 }], shippingAddress: ADDRESS })
    ).json()) as { orderNumber: string }
    expect(await stockOf('s1')).toBe(3)

    const cancel = await post(`/api/orders/${orderNumber}/cancel`, { contact: ADDRESS.email, reason: 'changed mind' })
    expect(cancel.status).toBe(200)
    expect(await stockOf('s1')).toBe(5) // restored

    const { order } = (await (await get(`/api/orders/track/${orderNumber}`)).json()) as { order: { status: string } }
    expect(order.status).toBe('cancelled')
  })
})

describe('reviews gate', () => {
  it('rejects a review for an order that is not delivered', async () => {
    const res = await post('/api/reviews', {
      orderNumber: 'ORD-NOPE0001', contact: 'jane@example.com',
      productId: 'p1', customerName: 'Jane', rating: 5,
    })
    expect(res.status).toBe(403)
  })
})

describe('stripe webhook', () => {
  it('rejects a request with a missing/invalid signature (400)', async () => {
    const noSig = await post('/api/stripe/webhook', { type: 'checkout.session.completed' })
    expect(noSig.status).toBe(400)

    const badSig = await SELF.fetch(`${BASE}/api/stripe/webhook`, {
      method: 'POST',
      headers: { 'stripe-signature': 't=1,v1=deadbeef' },
      body: '{}',
    })
    expect(badSig.status).toBe(400)
  })
})

describe('admin API (CF Access dev-bypass)', () => {
  it('creates a product and lists orders', async () => {
    const created = await post('/api/admin/products', { name: 'Admin Tee', description: 'x' })
    expect(created.status).toBe(201)
    const product = (await created.json()) as { id: string; name: string }
    expect(product.name).toBe('Admin Tee')

    const list = await get('/api/admin/orders')
    expect(list.status).toBe(200)
    expect((await list.json()) as { orders: unknown[] }).toHaveProperty('orders')
  })
})
