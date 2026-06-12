// End-to-end integration tests — the REAL worker running in workerd with a real
// (ephemeral) D1, KV and R2 via miniflare. Requests go through SELF.fetch, so
// routing, middleware, validation, DB writes and the order/stock/coupon logic
// are all exercised exactly as in production. ENVIRONMENT=development makes the
// Turnstile + CF Access checks bypass (see vitest.integration.config.ts).

import { env, SELF, fetchMock } from 'cloudflare:test'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { createDb } from 'worker/db/index'
import * as schema from 'worker/db/schema'
import { createOrder } from 'worker/lib/orders'
import { healthProbe } from 'worker/lib/health'
import type { HealthReport } from 'worker/lib/health'

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
  await db()
    .insert(schema.variants)
    .values({ id: 'v1', productId: 'p1', label: 'Black', sortOrder: 0 })
  await db()
    .insert(schema.sizeOptions)
    .values({ id: 's1', variantId: 'v1', size: 'M', priceCents, stock, active: true })
  return { productId: 'p1', variantId: 'v1', sizeId: 's1' }
}

const stockOf = async (id: string) =>
  (
    await db()
      .select({ stock: schema.sizeOptions.stock })
      .from(schema.sizeOptions)
      .where(eq(schema.sizeOptions.id, id))
      .get()
  )?.stock

// Stripe is an external API — never hit it in tests. Intercept outbound HTTP via
// miniflare's fetchMock so checkout-session creation exercises the real D1 path
// without network calls. Mirror the pattern used in coupons.integration.test.ts.
beforeAll(() => {
  fetchMock.activate()
  fetchMock
    .get('https://api.stripe.com')
    .intercept({ method: 'POST', path: /^\/v1\/checkout\/sessions/ })
    .reply(
      200,
      JSON.stringify({ id: 'cs_test_stub', url: 'https://checkout.stripe.com/pay/cs_test_stub' }),
      { headers: { 'Content-Type': 'application/json' } },
    )
    .persist()
})

// Tables cleared between tests (defensive — storage is also isolated per test).
const TABLES = [
  'coupon_uses',
  'reviews',
  'notify_me',
  'order_items',
  'orders',
  'coupons',
  'size_options',
  'product_images',
  'variants',
  'products',
  'store_config',
  'stripe_events',
  'push_subscriptions',
  'analytics_daily',
  'carts',
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

  it('GET /healthz → 200 + overall:ok when all bindings healthy', async () => {
    const res = await get('/healthz')
    expect(res.status).toBe(200)
    const body = (await res.json()) as HealthReport
    expect(body.overall).toBe('ok')
    expect(body.checks.db.ok).toBe(true)
    expect(body.checks.kv.ok).toBe(true)
    expect(body.checks.r2.ok).toBe(true)
    expect(typeof body.ts).toBe('string')
  })

  it('healthProbe → 503 shape when DB binding rejects; KV + R2 still ok', async () => {
    // Call healthProbe directly with a DB stub that throws, proving:
    //   (a) the DB failure is caught (ok: false, error set)
    //   (b) KV and R2 checks are NOT short-circuited (still ok: true)
    //   (c) healthProbe never throws — returns a HealthReport, not an exception
    const failingDb = {
      prepare: () => {
        throw new Error('simulated D1 failure')
      },
    } as unknown as D1Database
    const report = await healthProbe({ ...env, DB: failingDb })
    expect(report.overall).toBe('degraded')
    expect(report.checks.db.ok).toBe(false)
    expect(report.checks.db.error).toBeDefined()
    expect(report.checks.kv.ok).toBe(true)
    expect(report.checks.r2.ok).toBe(true)
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
    const { order } = (await track.json()) as {
      order: { totalCents: number; status: string; paymentMethod: string }
    }
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
    expect(await stockOf('s1')).toBe(0) // never negative, never double-sold
  })
})

describe('bank transfer', () => {
  it('exposes configured bank details publicly', async () => {
    await db()
      .insert(schema.storeConfig)
      .values([
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
    expect(order).toMatchObject({
      status: 'pending',
      paymentMethod: 'bank_transfer',
      totalCents: 1500,
    })
  })

  it('merchant confirms bank_transfer order via admin PATCH: pending→confirmed, stock unchanged', async () => {
    await seedProduct({ stock: 5, priceCents: 2000 })
    const placeRes = await post('/api/orders/bank-transfer', {
      items: [{ sizeOptionId: 's1', quantity: 2 }],
      shippingAddress: ADDRESS,
    })
    expect(placeRes.status).toBe(201)
    const { orderNumber } = (await placeRes.json()) as { orderNumber: string }

    expect(await stockOf('s1')).toBe(3) // reserved at order creation

    const patchRes = await SELF.fetch(`${BASE}/api/admin/orders/${orderNumber}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'confirmed' }),
    })
    expect(patchRes.status).toBe(200)
    expect(await patchRes.json()).toMatchObject({ ok: true, status: 'confirmed' })

    const { order } = (await (await get(`/api/orders/track/${orderNumber}`)).json()) as {
      order: { status: string }
    }
    expect(order.status).toBe('confirmed')

    // Confirm does not re-decrement stock
    expect(await stockOf('s1')).toBe(3)
  })
})

describe('coupons', () => {
  it('validates an active coupon and computes the discount', async () => {
    await db().insert(schema.coupons).values({
      id: 'c1',
      code: 'WELCOME10',
      type: 'percentage',
      value: 10,
      perCustomerLimit: 1,
      usedCount: 0,
      active: true,
    })
    const ok = await post('/api/coupons/validate', { code: 'WELCOME10', subtotalCents: 1000 })
    expect(await ok.json()).toMatchObject({ valid: true, discountCents: 100 })

    const bad = await post('/api/coupons/validate', { code: 'NOPE', subtotalCents: 1000 })
    expect(await bad.json()).toMatchObject({ valid: false })
  })
})

// ─── C1: POST /api/stripe/checkout-session ────────────────────────────────────
//
// Stripe's session.create is stubbed via fetchMock (see beforeAll above).
// What IS covered:
//   - body validation (400 on missing items)
//   - stripePriceId → sizeOptionId resolution + order + orderItems created in D1
//   - stock reserved (decremented) at session-creation time
//   - stripeSessionId persisted from the stubbed Stripe response
//   - tax line-item branch: tax inserted into Stripe payload (verified indirectly
//     via the order row's taxCents)
//   - coupon applied at session-creation: discountCents recorded on the order
//   - 422 on out-of-stock before the Stripe call is attempted
//   - 422 on invalid coupon code
// What is NOT covered by this harness:
//   - The actual Stripe-hosted checkout UI and payment flow
//   - session.url validity (Stripe returns the real hosted URL in production)
describe('stripe checkout-session POST', () => {
  it('validates body — rejects missing items (400)', async () => {
    const res = await post('/api/stripe/checkout-session', {})
    expect(res.status).toBe(400)
  })

  it('creates order + reserves stock + persists stripeSessionId', async () => {
    await seedProduct({ stock: 5, priceCents: 1000 })
    // Add stripePriceId to the sizeOption so the route can resolve it
    await db()
      .update(schema.sizeOptions)
      .set({ stripePriceId: 'price_test_s1' })
      .where(eq(schema.sizeOptions.id, 's1'))

    const res = await post('/api/stripe/checkout-session', {
      items: [{ stripePriceId: 'price_test_s1', quantity: 2 }],
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { url: string }
    expect(body.url).toBe('https://checkout.stripe.com/pay/cs_test_stub')

    // Order row created as pending with the stubbed session id
    const orders = await db().select().from(schema.orders).all()
    expect(orders).toHaveLength(1)
    expect(orders[0].status).toBe('pending')
    expect(orders[0].paymentMethod).toBe('stripe_checkout')
    expect(orders[0].stripeSessionId).toBe('cs_test_stub')
    expect(orders[0].subtotalCents).toBe(2000)

    // Order items created from the resolved sizeOptionId
    const items = await db().select().from(schema.orderItems).all()
    expect(items).toHaveLength(1)
    expect(items[0].sizeOptionId).toBe('s1')
    expect(items[0].quantity).toBe(2)

    // Stock reserved at session-creation time (5 - 2 = 3)
    expect(await stockOf('s1')).toBe(3)
  })

  it('records taxCents on the order when tax is enabled', async () => {
    await seedProduct({ stock: 5, priceCents: 2000 })
    await db()
      .update(schema.sizeOptions)
      .set({ stripePriceId: 'price_tax_s1' })
      .where(eq(schema.sizeOptions.id, 's1'))
    // Enable a 10% non-inclusive tax
    await db()
      .insert(schema.storeConfig)
      .values([
        { key: 'taxEnabled', value: 'true' },
        { key: 'taxRate', value: '10' },
        { key: 'taxInclusive', value: 'false' },
        { key: 'taxName', value: 'GST' },
        { key: 'taxBasis', value: 'subtotal' },
      ])

    const res = await post('/api/stripe/checkout-session', {
      items: [{ stripePriceId: 'price_tax_s1', quantity: 1 }],
    })
    expect(res.status).toBe(200)

    const order = await db().select().from(schema.orders).get()
    // 10% of 2000 = 200 tax cents
    expect(order?.taxCents).toBe(200)
    expect(order?.totalCents).toBe(2200)
  })

  it('applies coupon: discountCents on order + couponUses row written', async () => {
    await seedProduct({ stock: 5, priceCents: 2000 })
    await db()
      .update(schema.sizeOptions)
      .set({ stripePriceId: 'price_coup_s1' })
      .where(eq(schema.sizeOptions.id, 's1'))
    await db().insert(schema.coupons).values({
      id: 'coup_stripe',
      code: 'STRIPE10',
      type: 'percentage',
      value: 10,
      perCustomerLimit: 1,
      usedCount: 0,
      active: true,
    })

    const res = await post('/api/stripe/checkout-session', {
      items: [{ stripePriceId: 'price_coup_s1', quantity: 1 }],
      couponCode: 'STRIPE10',
    })
    expect(res.status).toBe(200)

    const order = await db().select().from(schema.orders).get()
    expect(order?.discountCents).toBe(200) // 10% of 2000
    expect(order?.couponCode).toBe('STRIPE10')

    // coupon_uses row created with null email (email unknown at session-creation time)
    const uses = await db()
      .select()
      .from(schema.couponUses)
      .where(eq(schema.couponUses.couponId, 'coup_stripe'))
      .all()
    expect(uses).toHaveLength(1)
    expect(uses[0].customerEmail).toBeNull()
  })

  it('returns 422 when an item is out of stock before the Stripe call', async () => {
    await seedProduct({ stock: 1, priceCents: 1000 })
    await db()
      .update(schema.sizeOptions)
      .set({ stripePriceId: 'price_oos_s1' })
      .where(eq(schema.sizeOptions.id, 's1'))

    const res = await post('/api/stripe/checkout-session', {
      items: [{ stripePriceId: 'price_oos_s1', quantity: 5 }],
    })
    expect(res.status).toBe(422)

    // No order created, stock unchanged
    const orders = await db().select().from(schema.orders).all()
    expect(orders).toHaveLength(0)
    expect(await stockOf('s1')).toBe(1)
  })

  it('returns 422 for an invalid coupon code', async () => {
    await seedProduct({ stock: 5, priceCents: 1000 })
    await db()
      .update(schema.sizeOptions)
      .set({ stripePriceId: 'price_badc_s1' })
      .where(eq(schema.sizeOptions.id, 's1'))

    const res = await post('/api/stripe/checkout-session', {
      items: [{ stripePriceId: 'price_badc_s1', quantity: 1 }],
      couponCode: 'DOESNOTEXIST',
    })
    expect(res.status).toBe(422)
  })
})

describe('cancellation', () => {
  it('cancels a pending order and restores stock', async () => {
    await seedProduct({ stock: 5, priceCents: 1000 })
    const { orderNumber } = (await (
      await post('/api/orders/cod', {
        items: [{ sizeOptionId: 's1', quantity: 2 }],
        shippingAddress: ADDRESS,
      })
    ).json()) as { orderNumber: string }
    expect(await stockOf('s1')).toBe(3)

    const cancel = await post(`/api/orders/${orderNumber}/cancel`, {
      contact: ADDRESS.email,
      reason: 'changed mind',
    })
    expect(cancel.status).toBe(200)
    expect(await stockOf('s1')).toBe(5) // restored

    const { order } = (await (await get(`/api/orders/track/${orderNumber}`)).json()) as {
      order: { status: string }
    }
    expect(order.status).toBe('cancelled')
  })
})

describe('reviews gate', () => {
  it('rejects a review for an order that is not delivered', async () => {
    const res = await post('/api/reviews', {
      orderNumber: 'ORD-NOPE0001',
      contact: 'jane@example.com',
      productId: 'p1',
      customerName: 'Jane',
      rating: 5,
    })
    expect(res.status).toBe(403)
  })
})

// Build a validly-signed Stripe webhook POST. The integration env injects
// STRIPE_WEBHOOK_SECRET: 'whsec_dummy' — we sign against the same secret so
// constructEventAsync accepts the request.
//
// Uses Web Crypto (crypto.subtle) instead of stripe.webhooks.generateTestHeaderString
// because that helper calls computeHMACSignature synchronously and throws
// "SubtleCryptoProvider cannot be used in a synchronous context" in workerd.
// The algorithm mirrors the Stripe SDK: HMAC-SHA256(key=utf8(secret), msg="${ts}.${payload}").
async function signedWebhook(eventPayload: object) {
  const payload = JSON.stringify(eventPayload)
  const timestamp = Math.floor(Date.now() / 1000)
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode('whsec_dummy'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sigBytes = await crypto.subtle.sign('HMAC', key, enc.encode(`${timestamp}.${payload}`))
  const hex = Array.from(new Uint8Array(sigBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return SELF.fetch(`${BASE}/api/stripe/webhook`, {
    method: 'POST',
    headers: { 'stripe-signature': `t=${timestamp},v1=${hex}` },
    body: payload,
  })
}

// Insert a pending stripe_checkout order (mirrors the state left by POST
// /api/stripe/checkout-session before the hosted checkout completes).
async function seedStripeOrder(opts: { stock?: number; couponCode?: string } = {}) {
  const { stock = 5, couponCode } = opts
  await seedProduct({ stock, priceCents: 1000 })
  const { orderId } = await createOrder(db(), {
    paymentMethod: 'stripe_checkout',
    items: [{ sizeOptionId: 's1', quantity: 2 }],
    couponCode,
  })
  return orderId
}

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

  it('checkout.session.completed confirms order + populates customer + records stripe_events', async () => {
    const orderId = await seedStripeOrder()
    const stockAfterReserve = await stockOf('s1') // 5 - 2 = 3 (reserved at session create)

    const res = await signedWebhook({
      id: 'evt_completed_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_x',
          metadata: { orderId },
          payment_intent: 'pi_test_x',
          customer_details: { name: 'Jane Doe', email: 'jane@example.com' },
        },
      },
    })
    expect(res.status).toBe(200)

    const order = await db().select().from(schema.orders).where(eq(schema.orders.id, orderId)).get()
    expect(order?.status).toBe('confirmed')
    expect(order?.customerName).toBe('Jane Doe')
    expect(order?.customerEmail).toBe('jane@example.com')
    expect(order?.stripePaymentIntentId).toBe('pi_test_x')

    const evtRow = await db()
      .select()
      .from(schema.stripeEvents)
      .where(eq(schema.stripeEvents.eventId, 'evt_completed_1'))
      .get()
    expect(evtRow).toBeTruthy()
    expect(evtRow?.type).toBe('checkout.session.completed')

    // Stock was reserved at checkout-session creation, NOT at webhook time
    expect(await stockOf('s1')).toBe(stockAfterReserve)
  })

  it('checkout.session.completed is idempotent: same event id processed exactly once', async () => {
    const orderId = await seedStripeOrder()
    const event = {
      id: 'evt_idem_complete',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_idem',
          metadata: { orderId },
          payment_intent: 'pi_idem',
          customer_details: { name: 'Bob', email: 'bob@example.com' },
        },
      },
    }

    await signedWebhook(event)
    const res2 = await signedWebhook(event)
    expect(res2.status).toBe(200)

    const rows = await db()
      .select()
      .from(schema.stripeEvents)
      .where(eq(schema.stripeEvents.eventId, 'evt_idem_complete'))
      .all()
    expect(rows).toHaveLength(1)

    const order = await db()
      .select({ status: schema.orders.status })
      .from(schema.orders)
      .where(eq(schema.orders.id, orderId))
      .get()
    expect(order?.status).toBe('confirmed')
  })

  it('checkout.session.expired cancels pending order + releases inventory + reverts coupon', async () => {
    await db().insert(schema.coupons).values({
      id: 'c_exp',
      code: 'EXPIRE10',
      type: 'percentage',
      value: 10,
      perCustomerLimit: 1,
      usedCount: 0,
      active: true,
    })
    const orderId = await seedStripeOrder({ stock: 5, couponCode: 'EXPIRE10' })

    expect(await stockOf('s1')).toBe(3) // 5 - 2 reserved
    const usesBefore = await db()
      .select()
      .from(schema.couponUses)
      .where(eq(schema.couponUses.couponId, 'c_exp'))
      .all()
    expect(usesBefore).toHaveLength(1)

    const res = await signedWebhook({
      id: 'evt_expired_1',
      type: 'checkout.session.expired',
      data: { object: { id: 'cs_test_exp', metadata: { orderId } } },
    })
    expect(res.status).toBe(200)

    const order = await db()
      .select({ status: schema.orders.status })
      .from(schema.orders)
      .where(eq(schema.orders.id, orderId))
      .get()
    expect(order?.status).toBe('cancelled')

    expect(await stockOf('s1')).toBe(5) // restored

    const usesAfter = await db()
      .select()
      .from(schema.couponUses)
      .where(eq(schema.couponUses.couponId, 'c_exp'))
      .all()
    expect(usesAfter).toHaveLength(0) // coupon_uses row deleted

    const evtRow = await db()
      .select()
      .from(schema.stripeEvents)
      .where(eq(schema.stripeEvents.eventId, 'evt_expired_1'))
      .get()
    expect(evtRow).toBeTruthy()
  })

  it('checkout.session.expired does not cancel an already-confirmed order', async () => {
    const orderId = await seedStripeOrder({ stock: 5 })
    // Manually confirm (simulates completed webhook already fired)
    await db()
      .update(schema.orders)
      .set({ status: 'confirmed' })
      .where(eq(schema.orders.id, orderId))
    const stockAtConfirm = await stockOf('s1') // 3 (reserved, not released)

    await signedWebhook({
      id: 'evt_guard_1',
      type: 'checkout.session.expired',
      data: { object: { id: 'cs_test_guard', metadata: { orderId } } },
    })

    const order = await db()
      .select({ status: schema.orders.status })
      .from(schema.orders)
      .where(eq(schema.orders.id, orderId))
      .get()
    expect(order?.status).toBe('confirmed') // guard: status unchanged

    expect(await stockOf('s1')).toBe(stockAtConfirm) // stock unchanged (release not triggered)
  })

  it('checkout.session.expired is idempotent: inventory released exactly once on replay', async () => {
    const orderId = await seedStripeOrder({ stock: 5 })
    expect(await stockOf('s1')).toBe(3)

    const event = {
      id: 'evt_idem_exp',
      type: 'checkout.session.expired',
      data: { object: { id: 'cs_test_idem_exp', metadata: { orderId } } },
    }
    await signedWebhook(event)
    await signedWebhook(event) // replay

    expect(await stockOf('s1')).toBe(5) // restored once, not double-credited

    const rows = await db()
      .select()
      .from(schema.stripeEvents)
      .where(eq(schema.stripeEvents.eventId, 'evt_idem_exp'))
      .all()
    expect(rows).toHaveLength(1) // idempotency row written once
  })

  // H2: per-customer coupon limit attribution for Stripe orders.
  // createOrder writes coupon_uses with customerEmail=null (contact unknown at
  // session-creation). checkout.session.completed must backfill customerEmail so
  // the per-customer cap counts this use for the customer's future orders.
  it('checkout.session.completed backfills coupon_uses.customerEmail for per-customer limit', async () => {
    await db().insert(schema.coupons).values({
      id: 'c_attr',
      code: 'ATTR10',
      type: 'percentage',
      value: 10,
      perCustomerLimit: 1,
      usedCount: 0,
      active: true,
    })
    const orderId = await seedStripeOrder({ stock: 5, couponCode: 'ATTR10' })

    // Before webhook: coupon_uses row exists with null email
    const usesBefore = await db()
      .select()
      .from(schema.couponUses)
      .where(eq(schema.couponUses.couponId, 'c_attr'))
      .all()
    expect(usesBefore).toHaveLength(1)
    expect(usesBefore[0].customerEmail).toBeNull()

    // Fire completed webhook with real customer email
    await signedWebhook({
      id: 'evt_attr_complete',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_attr',
          metadata: { orderId },
          payment_intent: 'pi_attr',
          customer_details: { name: 'Alice', email: 'alice@example.com' },
        },
      },
    })

    // coupon_uses row is backfilled with the real email
    const usesAfter = await db()
      .select()
      .from(schema.couponUses)
      .where(eq(schema.couponUses.couponId, 'c_attr'))
      .all()
    expect(usesAfter).toHaveLength(1)
    expect(usesAfter[0].customerEmail).toBe('alice@example.com')
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
