// Integration tests for coupon routes:
//   POST /api/admin/coupons     — create coupon
//   GET  /api/admin/coupons     — list coupons
//   PUT  /api/admin/coupons/:id — update coupon
//   POST /api/coupons/validate  — validate a coupon code
//   POST /api/orders/cod (with coupon) — coupon applied during order placement

import { env, SELF, fetchMock } from 'cloudflare:test'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { createDb } from 'worker/db/index'
import * as schema from 'worker/db/schema'

// Stripe is an external API — never hit it in tests. The admin coupon route syncs
// to Stripe when STRIPE_SECRET_KEY is set (the dummy test key would make a real
// call that fails → 502). Intercept Stripe's outbound HTTP via miniflare's
// fetchMock so the route exercises the real D1 CRUD path with stubbed Stripe ids.
beforeAll(() => {
  fetchMock.activate()
  const stripe = fetchMock.get('https://api.stripe.com')
  stripe
    .intercept({ method: 'POST', path: /^\/v1\/coupons/ })
    .reply(200, { id: 'co_test', object: 'coupon' })
    .persist()
  stripe
    .intercept({ method: 'POST', path: /^\/v1\/promotion_codes/ })
    .reply(200, { id: 'promo_test', object: 'promotion_code', active: true })
    .persist()
})

const db = () => createDb(env.DB)
const BASE = 'https://shop.test'

const get = (path: string) => SELF.fetch(`${BASE}${path}`)

const post = (path: string, body: unknown) =>
  SELF.fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

const adminPost = (path: string, body: unknown) => post(path, body)

const adminPut = (path: string, body: unknown) =>
  SELF.fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

const adminDelete = (path: string) => SELF.fetch(`${BASE}${path}`, { method: 'DELETE' })

// ─── Cleanup ──────────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function seedProduct(opts: { stock?: number; priceCents?: number } = {}) {
  const { stock = 5, priceCents = 2000 } = opts
  await db().insert(schema.products).values({ id: 'p1', name: 'Demo Tee', active: true })
  await db()
    .insert(schema.variants)
    .values({ id: 'v1', productId: 'p1', label: 'Black', sortOrder: 0 })
  await db()
    .insert(schema.sizeOptions)
    .values({ id: 's1', variantId: 'v1', size: 'M', priceCents, stock, active: true })
  return { productId: 'p1', variantId: 'v1', sizeId: 's1' }
}

const ADDRESS = {
  name: 'Jane Doe',
  phone: '+923001234567',
  email: 'jane@example.com',
  address: '12 Market Road',
  city: 'Karachi',
  country: 'PK',
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/admin/coupons', () => {
  it('creates a percentage coupon and returns it (201)', async () => {
    const res = await adminPost('/api/admin/coupons', {
      code: 'SAVE10',
      type: 'percentage',
      value: 10,
      active: true,
      perCustomerLimit: 1,
    })
    expect(res.status).toBe(201)
    const coupon = (await res.json()) as Record<string, unknown>
    expect(coupon.code).toBe('SAVE10')
    expect(coupon.type).toBe('percentage')
    expect(coupon.value).toBe(10)
    expect(coupon.active).toBe(true)
  })

  it('creates a flat discount coupon (201)', async () => {
    const res = await adminPost('/api/admin/coupons', {
      code: 'FLAT200',
      type: 'fixed',
      value: 200,
      active: true,
      perCustomerLimit: 2,
    })
    expect(res.status).toBe(201)
    const coupon = (await res.json()) as Record<string, unknown>
    expect(coupon.code).toBe('FLAT200')
    expect(coupon.type).toBe('fixed')
    expect(coupon.value).toBe(200)
  })

  it('rejects duplicate coupon code (409)', async () => {
    await adminPost('/api/admin/coupons', {
      code: 'DUPECODE',
      type: 'percentage',
      value: 5,
      active: true,
      perCustomerLimit: 1,
    })
    const res = await adminPost('/api/admin/coupons', {
      code: 'DUPECODE',
      type: 'fixed',
      value: 100,
      active: true,
      perCustomerLimit: 1,
    })
    expect(res.status).toBe(409)
    const body = (await res.json()) as { error: string }
    expect(body.error).toMatch(/already exists/i)
  })

  it('rejects invalid payload (400)', async () => {
    const res = await adminPost('/api/admin/coupons', { code: '', type: 'unknown' })
    expect(res.status).toBe(400)
  })
})

describe('GET /api/admin/coupons', () => {
  it('returns empty list when no coupons exist', async () => {
    const res = await get('/api/admin/coupons')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { coupons: unknown[] }
    expect(body.coupons).toHaveLength(0)
  })

  it('lists all coupons ordered newest-first', async () => {
    await adminPost('/api/admin/coupons', {
      code: 'FIRSTONE',
      type: 'percentage',
      value: 5,
      active: true,
      perCustomerLimit: 1,
    })
    await adminPost('/api/admin/coupons', {
      code: 'SECOND',
      type: 'percentage',
      value: 10,
      active: true,
      perCustomerLimit: 1,
    })

    const res = await get('/api/admin/coupons')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { coupons: Array<{ code: string }> }
    expect(body.coupons).toHaveLength(2)
    // newest first — SECOND was inserted last
    expect(body.coupons[0].code).toBe('SECOND')
    expect(body.coupons[1].code).toBe('FIRSTONE')
  })
})

describe('PUT /api/admin/coupons/:id', () => {
  it('updates coupon active flag', async () => {
    const createRes = await adminPost('/api/admin/coupons', {
      code: 'TOGGLE',
      type: 'percentage',
      value: 15,
      active: true,
      perCustomerLimit: 1,
    })
    const created = (await createRes.json()) as { id: string; active: boolean }

    const updateRes = await adminPut(`/api/admin/coupons/${created.id}`, { active: false })
    expect(updateRes.status).toBe(200)
    const updated = (await updateRes.json()) as { active: boolean }
    expect(updated.active).toBe(false)
  })

  it('returns 404 for non-existent coupon', async () => {
    const res = await adminPut('/api/admin/coupons/doesnotexist', { active: false })
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/admin/coupons/:id', () => {
  it('soft-deactivates the coupon (active=false)', async () => {
    const createRes = await adminPost('/api/admin/coupons', {
      code: 'SOFTDEL',
      type: 'fixed',
      value: 50,
      active: true,
      perCustomerLimit: 1,
    })
    const created = (await createRes.json()) as { id: string }

    const delRes = await adminDelete(`/api/admin/coupons/${created.id}`)
    expect(delRes.status).toBe(200)

    const row = await db()
      .select({ active: schema.coupons.active })
      .from(schema.coupons)
      .where(eq(schema.coupons.id, created.id))
      .get()
    expect(row?.active).toBe(false)
  })
})

describe('POST /api/coupons/validate', () => {
  it('returns valid=true + discountCents for an active percentage coupon', async () => {
    await db().insert(schema.coupons).values({
      id: 'c1',
      code: 'WELCOME10',
      type: 'percentage',
      value: 10,
      perCustomerLimit: 1,
      usedCount: 0,
      active: true,
    })

    const res = await post('/api/coupons/validate', { code: 'WELCOME10', subtotalCents: 2000 })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { valid: boolean; discountCents: number }
    expect(body.valid).toBe(true)
    expect(body.discountCents).toBe(200)
  })

  it('returns valid=true + discountCents for an active flat coupon', async () => {
    await db().insert(schema.coupons).values({
      id: 'c2',
      code: 'FLAT100',
      type: 'fixed',
      value: 100,
      perCustomerLimit: 2,
      usedCount: 0,
      active: true,
    })

    const res = await post('/api/coupons/validate', { code: 'FLAT100', subtotalCents: 1500 })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { valid: boolean; discountCents: number }
    expect(body.valid).toBe(true)
    expect(body.discountCents).toBe(100)
  })

  it('returns valid=false for unknown code', async () => {
    const res = await post('/api/coupons/validate', { code: 'NOPE', subtotalCents: 1000 })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { valid: boolean }
    expect(body.valid).toBe(false)
  })

  it('returns valid=false for inactive coupon', async () => {
    await db().insert(schema.coupons).values({
      id: 'c3',
      code: 'INACTIVE',
      type: 'percentage',
      value: 20,
      perCustomerLimit: 1,
      usedCount: 0,
      active: false,
    })

    const res = await post('/api/coupons/validate', { code: 'INACTIVE', subtotalCents: 1000 })
    const body = (await res.json()) as { valid: boolean }
    expect(body.valid).toBe(false)
  })

  it('returns valid=false when subtotal is below minOrderCents', async () => {
    await db().insert(schema.coupons).values({
      id: 'c4',
      code: 'MINORDER',
      type: 'fixed',
      value: 50,
      minOrderCents: 1000,
      perCustomerLimit: 1,
      usedCount: 0,
      active: true,
    })

    const res = await post('/api/coupons/validate', { code: 'MINORDER', subtotalCents: 500 })
    const body = (await res.json()) as { valid: boolean }
    expect(body.valid).toBe(false)
  })

  it('returns 400 for invalid payload', async () => {
    const res = await post('/api/coupons/validate', { code: '' })
    expect(res.status).toBe(400)
  })
})

describe('POST /api/orders/cod with coupon', () => {
  it('applies a valid coupon and reduces total correctly', async () => {
    await seedProduct({ priceCents: 2000, stock: 5 })
    await db().insert(schema.coupons).values({
      id: 'coup1',
      code: 'ORDER10',
      type: 'percentage',
      value: 10,
      perCustomerLimit: 1,
      usedCount: 0,
      active: true,
    })

    const res = await post('/api/orders/cod', {
      items: [{ sizeOptionId: 's1', quantity: 1 }],
      shippingAddress: ADDRESS,
      couponCode: 'ORDER10',
    })
    expect(res.status).toBe(201)
    const { orderNumber } = (await res.json()) as { orderNumber: string }

    const track = await get(`/api/orders/track/${orderNumber}`)
    const { order } = (await track.json()) as {
      order: { subtotalCents: number; discountCents: number; totalCents: number }
    }
    expect(order.subtotalCents).toBe(2000)
    expect(order.discountCents).toBe(200)
    expect(order.totalCents).toBe(1800)
  })

  it('rejects an order with an invalid coupon code (422)', async () => {
    await seedProduct({ priceCents: 2000, stock: 5 })

    const res = await post('/api/orders/cod', {
      items: [{ sizeOptionId: 's1', quantity: 1 }],
      shippingAddress: ADDRESS,
      couponCode: 'BADCODE',
    })
    expect(res.status).toBe(422)
  })

  it('concurrent orders: global usageLimit=1 — exactly one wins, usedCount never exceeds limit', async () => {
    // Seed enough stock so the race is on the coupon slot, not on inventory.
    await seedProduct({ priceCents: 2000, stock: 10 })
    await db().insert(schema.coupons).values({
      id: 'race-coup',
      code: 'ONETIME',
      type: 'fixed',
      value: 100,
      usageLimit: 1,
      perCustomerLimit: 99,
      usedCount: 0,
      active: true,
    })

    const body = {
      items: [{ sizeOptionId: 's1', quantity: 1 }],
      shippingAddress: ADDRESS,
      couponCode: 'ONETIME',
    }
    const [r1, r2] = await Promise.all([
      post('/api/orders/cod', body),
      post('/api/orders/cod', body),
    ])

    const statuses = [r1.status, r2.status].sort()
    // Exactly one order succeeds, the other gets a 422 (CouponError)
    expect(statuses).toEqual([201, 422])

    // usedCount must be exactly 1 — never 2
    const row = await db()
      .select({ usedCount: schema.coupons.usedCount })
      .from(schema.coupons)
      .where(eq(schema.coupons.id, 'race-coup'))
      .get()
    expect(row?.usedCount).toBe(1)
  })

  it('failed order (out-of-stock) does NOT permanently consume a coupon slot', async () => {
    // Stock=1 so the second order will hit a StockError during reservation.
    // The coupon slot claimed atomically must be released.
    await seedProduct({ priceCents: 2000, stock: 1 })
    await db().insert(schema.coupons).values({
      id: 'rollback-coup',
      code: 'ROLLBACK5',
      type: 'fixed',
      value: 100,
      usageLimit: 5,
      perCustomerLimit: 99,
      usedCount: 0,
      active: true,
    })

    const body = (extraQty: number) => ({
      items: [{ sizeOptionId: 's1', quantity: extraQty }],
      shippingAddress: ADDRESS,
      couponCode: 'ROLLBACK5',
    })

    // First order succeeds (takes the only stock unit)
    const r1 = await post('/api/orders/cod', body(1))
    expect(r1.status).toBe(201)

    // Second order fails — out of stock
    const r2 = await post('/api/orders/cod', body(1))
    expect(r2.status).toBe(422)

    // usedCount should be 1 (only the successful order), not 2
    const row = await db()
      .select({ usedCount: schema.coupons.usedCount })
      .from(schema.coupons)
      .where(eq(schema.coupons.id, 'rollback-coup'))
      .get()
    expect(row?.usedCount).toBe(1)
  })
})
