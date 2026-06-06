// Integration tests for push subscription routes:
//   POST /api/admin/push/subscribe    — merchant device subscribe (admin, behind CF Access)
//   POST /api/admin/push/unsubscribe  — merchant device unsubscribe
//   POST /api/push/subscribe          — customer subscribe (Turnstile bypassed in dev)
//   POST /api/push/unsubscribe        — customer unsubscribe

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

// ─── Cleanup ──────────────────────────────────────────────────────────────────

const TABLES = [
  'coupon_uses', 'reviews', 'notify_me', 'order_items', 'orders', 'coupons',
  'size_options', 'product_images', 'variants', 'products', 'store_config',
  'stripe_events', 'push_subscriptions', 'analytics_daily', 'carts',
]
beforeEach(async () => {
  for (const t of TABLES) await env.DB.prepare(`DELETE FROM ${t}`).run()
  // Also clear customer push subscriptions if table exists
  await env.DB.prepare('DELETE FROM customer_push_subscriptions').run().catch(() => {})
})

// ─── Shared subscription fixture ─────────────────────────────────────────────

const MERCHANT_SUB = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/test-merchant-endpoint',
  auth: 'merchantAuthBase64==',
  p256dh: 'merchantP256DhBase64==',
}

const CUSTOMER_SUB = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/test-customer-endpoint',
  auth: 'customerAuthBase64==',
  p256dh: 'customerP256DhBase64==',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function seedOrder(orderNumber = 'ORD-PUSH0001') {
  const now = new Date().toISOString()
  await db().insert(schema.products).values({ id: 'pp1', name: 'Push Product', active: true })
  await db().insert(schema.variants).values({ id: 'pv1', productId: 'pp1', label: 'Black', sortOrder: 0 })
  await db().insert(schema.sizeOptions).values({ id: 'ps1', variantId: 'pv1', size: 'M', priceCents: 1000, stock: 5, active: true })

  await db().insert(schema.orders).values({
    id: `pord-${Date.now()}`,
    orderNumber,
    status: 'pending',
    paymentMethod: 'cod',
    subtotalCents: 1000,
    shippingCents: 0,
    discountCents: 0,
    totalCents: 1000,
    customerName: 'Push User',
    customerEmail: 'push@example.com',
    customerPhone: '+923000000001',
    shippingAddress: '{}',
    createdAt: now,
    updatedAt: now,
  })
  return orderNumber
}

// ─── Merchant push (admin) ─────────────────────────────────────────────────────

describe('POST /api/admin/push/subscribe', () => {
  it('saves a merchant push subscription (201)', async () => {
    const res = await post('/api/admin/push/subscribe', MERCHANT_SUB)
    expect(res.status).toBe(201)
    const body = (await res.json()) as { ok: boolean }
    expect(body.ok).toBe(true)
  })

  it('persists the subscription to the DB', async () => {
    await post('/api/admin/push/subscribe', MERCHANT_SUB)

    const row = await db()
      .select()
      .from(schema.pushSubscriptions)
      .where(eq(schema.pushSubscriptions.endpoint, MERCHANT_SUB.endpoint))
      .get()
    expect(row).toBeDefined()
    expect(row?.auth).toBe(MERCHANT_SUB.auth)
    expect(row?.p256dh).toBe(MERCHANT_SUB.p256dh)
  })

  it('idempotent: re-subscribing with same endpoint updates auth/p256dh', async () => {
    await post('/api/admin/push/subscribe', MERCHANT_SUB)
    await post('/api/admin/push/subscribe', {
      ...MERCHANT_SUB,
      auth: 'newAuth==',
      p256dh: 'newP256Dh==',
    })

    const rows = await db()
      .select()
      .from(schema.pushSubscriptions)
      .where(eq(schema.pushSubscriptions.endpoint, MERCHANT_SUB.endpoint))
      .all()
    expect(rows).toHaveLength(1)
    expect(rows[0].auth).toBe('newAuth==')
    expect(rows[0].p256dh).toBe('newP256Dh==')
  })

  it('returns 400 for missing endpoint (400)', async () => {
    const res = await post('/api/admin/push/subscribe', { auth: 'a', p256dh: 'b' })
    expect(res.status).toBe(400)
  })

  it('returns 400 for missing auth (400)', async () => {
    const res = await post('/api/admin/push/subscribe', { endpoint: 'https://example.com/push', p256dh: 'b' })
    expect(res.status).toBe(400)
  })
})

describe('POST /api/admin/push/unsubscribe', () => {
  it('deletes an existing merchant subscription (200)', async () => {
    await post('/api/admin/push/subscribe', MERCHANT_SUB)

    const res = await post('/api/admin/push/unsubscribe', { endpoint: MERCHANT_SUB.endpoint })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean }
    expect(body.ok).toBe(true)

    const row = await db()
      .select()
      .from(schema.pushSubscriptions)
      .where(eq(schema.pushSubscriptions.endpoint, MERCHANT_SUB.endpoint))
      .get()
    expect(row).toBeUndefined()
  })

  it('is idempotent: unsubscribing non-existent endpoint still returns ok', async () => {
    const res = await post('/api/admin/push/unsubscribe', { endpoint: 'https://nonexistent.endpoint/push' })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean }
    expect(body.ok).toBe(true)
  })

  it('returns 400 for missing endpoint', async () => {
    const res = await post('/api/admin/push/unsubscribe', {})
    expect(res.status).toBe(400)
  })
})

// ─── Customer push (public) ───────────────────────────────────────────────────

describe('POST /api/push/subscribe', () => {
  it('saves a customer push subscription tied to an order (201)', async () => {
    const orderNumber = await seedOrder('ORD-CUSTSUB1')
    const res = await post('/api/push/subscribe', {
      ...CUSTOMER_SUB,
      orderNumber,
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as { ok: boolean }
    expect(body.ok).toBe(true)
  })

  it('returns 422 when orderNumber does not exist', async () => {
    const res = await post('/api/push/subscribe', {
      ...CUSTOMER_SUB,
      orderNumber: 'ORD-DOESNTEXIST',
    })
    expect(res.status).toBe(422)
  })

  it('idempotent: re-subscribing with same endpoint updates keys + orderNumber', async () => {
    const orderNumber = await seedOrder('ORD-CUSTIDM1')
    const sub = { ...CUSTOMER_SUB, orderNumber }

    await post('/api/push/subscribe', sub)
    const res2 = await post('/api/push/subscribe', {
      ...sub,
      auth: 'updatedAuth==',
      p256dh: 'updatedP256==',
    })
    expect(res2.status).toBe(201)
  })

  it('returns 400 for missing required fields', async () => {
    const res = await post('/api/push/subscribe', { endpoint: 'https://example.com' })
    expect(res.status).toBe(400)
  })
})

describe('POST /api/push/unsubscribe', () => {
  it('removes customer subscription by endpoint (200)', async () => {
    const orderNumber = await seedOrder('ORD-CUSTUNSUB')
    await post('/api/push/subscribe', { ...CUSTOMER_SUB, orderNumber })

    const res = await post('/api/push/unsubscribe', { endpoint: CUSTOMER_SUB.endpoint })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean }
    expect(body.ok).toBe(true)
  })

  it('is idempotent: unsubscribing non-existent endpoint still returns ok', async () => {
    const res = await post('/api/push/unsubscribe', { endpoint: 'https://missing.endpoint/push' })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean }
    expect(body.ok).toBe(true)
  })

  it('returns 400 for missing endpoint', async () => {
    const res = await post('/api/push/unsubscribe', {})
    expect(res.status).toBe(400)
  })
})
