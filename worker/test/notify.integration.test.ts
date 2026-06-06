// Integration tests for notify (restock request) routes:
//   POST /api/notify             — subscribe for OOS restock alert
//   GET  /api/admin/notify       — admin view of aggregated restock requests

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

/** Seeds an OOS size option (stock=0) */
async function seedOOSProduct() {
  await db().insert(schema.products).values({ id: 'p1', name: 'Hot Item', active: true })
  await db().insert(schema.variants).values({ id: 'v1', productId: 'p1', label: 'Black', sortOrder: 0 })
  await db().insert(schema.sizeOptions).values({
    id: 's1', variantId: 'v1', size: 'M', priceCents: 1500, stock: 0, active: true,
  })
  return { productId: 'p1', variantId: 'v1', sizeId: 's1' }
}

/** Seeds an in-stock size option (stock > 0) */
async function seedInStockProduct() {
  await db().insert(schema.products).values({ id: 'p2', name: 'Available Item', active: true })
  await db().insert(schema.variants).values({ id: 'v2', productId: 'p2', label: 'White', sortOrder: 0 })
  await db().insert(schema.sizeOptions).values({
    id: 's2', variantId: 'v2', size: 'L', priceCents: 1500, stock: 5, active: true,
  })
  return { productId: 'p2', variantId: 'v2', sizeId: 's2' }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/notify', () => {
  it('accepts a restock request for an OOS item (200)', async () => {
    await seedOOSProduct()
    const res = await post('/api/notify', {
      sizeOptionId: 's1',
      email: 'jane@example.com',
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean }
    expect(body.ok).toBe(true)
  })

  it('inserts a notify_me row in the DB', async () => {
    await seedOOSProduct()
    await post('/api/notify', {
      sizeOptionId: 's1',
      email: 'customer@example.com',
    })

    const row = await db()
      .select()
      .from(schema.notifyMe)
      .where(eq(schema.notifyMe.sizeOptionId, 's1'))
      .get()
    expect(row).toBeDefined()
    expect(row?.email).toBe('customer@example.com')
    expect(row?.notified).toBe(false)
  })

  it('accepts a notify request with phone only', async () => {
    await seedOOSProduct()
    const res = await post('/api/notify', {
      sizeOptionId: 's1',
      phone: '+923001234567',
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean }
    expect(body.ok).toBe(true)
  })

  it('accepts with both email and phone', async () => {
    await seedOOSProduct()
    const res = await post('/api/notify', {
      sizeOptionId: 's1',
      email: 'dual@example.com',
      phone: '+923009876543',
    })
    expect(res.status).toBe(200)
  })

  it('rejects when the item is in stock (400)', async () => {
    await seedInStockProduct()
    const res = await post('/api/notify', {
      sizeOptionId: 's2',
      email: 'eager@example.com',
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toMatch(/in stock/i)
  })

  it('returns 404 for non-existent size option', async () => {
    const res = await post('/api/notify', {
      sizeOptionId: 'ghost',
      email: 'nobody@example.com',
    })
    expect(res.status).toBe(404)
  })

  it('returns duplicate=true for the same sizeOptionId+email combination', async () => {
    await seedOOSProduct()
    await post('/api/notify', { sizeOptionId: 's1', email: 'dup@example.com' })

    const res2 = await post('/api/notify', { sizeOptionId: 's1', email: 'dup@example.com' })
    expect(res2.status).toBe(200)
    const body = (await res2.json()) as { ok: boolean; duplicate: boolean }
    expect(body.ok).toBe(true)
    expect(body.duplicate).toBe(true)
  })

  it('returns 400 for invalid payload (missing both email and phone)', async () => {
    await seedOOSProduct()
    const res = await post('/api/notify', { sizeOptionId: 's1' })
    expect(res.status).toBe(400)
  })
})

describe('GET /api/admin/notify', () => {
  it('returns empty requests list when no notify_me rows', async () => {
    const res = await get('/api/admin/notify')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { requests: unknown[] }
    expect(body.requests).toHaveLength(0)
  })

  it('returns aggregated pending requests grouped by sizeOptionId', async () => {
    await seedOOSProduct()

    // Two different customers for same OOS size
    await post('/api/notify', { sizeOptionId: 's1', email: 'a@example.com' })
    await post('/api/notify', { sizeOptionId: 's1', email: 'b@example.com' })

    const res = await get('/api/admin/notify')
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      requests: Array<{
        sizeOptionId: string
        waiting: number
        productName: string
        variantLabel: string
        size: string
        inStock: boolean
      }>
    }
    expect(body.requests).toHaveLength(1)
    expect(body.requests[0].sizeOptionId).toBe('s1')
    expect(body.requests[0].waiting).toBe(2)
    expect(body.requests[0].productName).toBe('Hot Item')
    expect(body.requests[0].variantLabel).toBe('Black')
    expect(body.requests[0].size).toBe('M')
    expect(body.requests[0].inStock).toBe(false)
  })

  it('orders by waiting count descending', async () => {
    // Two OOS products
    await db().insert(schema.products).values([
      { id: 'pa', name: 'Product A', active: true },
      { id: 'pb', name: 'Product B', active: true },
    ])
    await db().insert(schema.variants).values([
      { id: 'va', productId: 'pa', label: 'Red', sortOrder: 0 },
      { id: 'vb', productId: 'pb', label: 'Blue', sortOrder: 0 },
    ])
    await db().insert(schema.sizeOptions).values([
      { id: 'sa', variantId: 'va', size: 'S', priceCents: 1000, stock: 0, active: true },
      { id: 'sb', variantId: 'vb', size: 'XL', priceCents: 1000, stock: 0, active: true },
    ])

    // 1 subscriber for sa, 3 for sb
    await post('/api/notify', { sizeOptionId: 'sa', email: 'one@example.com' })
    await post('/api/notify', { sizeOptionId: 'sb', email: 'two@example.com' })
    await post('/api/notify', { sizeOptionId: 'sb', email: 'three@example.com' })
    await post('/api/notify', { sizeOptionId: 'sb', email: 'four@example.com' })

    const res = await get('/api/admin/notify')
    const body = (await res.json()) as {
      requests: Array<{ sizeOptionId: string; waiting: number }>
    }
    // sb has 3 waiters — should be first
    expect(body.requests[0].sizeOptionId).toBe('sb')
    expect(body.requests[0].waiting).toBe(3)
    expect(body.requests[1].sizeOptionId).toBe('sa')
    expect(body.requests[1].waiting).toBe(1)
  })

  it('does not include already-notified rows', async () => {
    await seedOOSProduct()

    // Insert a row that has already been notified
    await db().insert(schema.notifyMe).values({
      id: 'nm-notified',
      sizeOptionId: 's1',
      email: 'notified@example.com',
      phone: null,
      notified: true,
    })

    const res = await get('/api/admin/notify')
    const body = (await res.json()) as { requests: unknown[] }
    expect(body.requests).toHaveLength(0)
  })
})
