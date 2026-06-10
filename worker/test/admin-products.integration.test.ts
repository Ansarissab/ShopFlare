// Integration tests for admin product routes:
//   POST   /api/admin/products          — create product
//   GET    /api/admin/products          — list all (incl. inactive)
//   GET    /api/admin/products/:id      — get product by id
//   PUT    /api/admin/products/:id      — update product
//   DELETE /api/admin/products/:id      — soft-delete
//   POST   /api/admin/products/variants — add variant
//   PUT    /api/admin/products/variants/:id — update variant
//   POST   /api/admin/products/sizes    — add size option
//   PUT    /api/admin/products/sizes/:id — update size option
//   DELETE /api/admin/products/sizes/:id — delete size option

import { env, SELF } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { createDb } from 'worker/db/index'
import * as schema from 'worker/db/schema'

const db = () => createDb(env.DB)
const BASE = 'https://shop.test'

const get = (path: string) => SELF.fetch(`${BASE}${path}`)

const adminPost = (path: string, body: unknown) =>
  SELF.fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

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

async function createProduct(overrides: Record<string, unknown> = {}) {
  const res = await adminPost('/api/admin/products', { name: 'Test Product', ...overrides })
  const product = (await res.json()) as { id: string; name: string; active: boolean }
  return { status: res.status, product }
}

async function addVariant(productId: string, label = 'Black') {
  const res = await adminPost('/api/admin/products/variants', { productId, label, sortOrder: 0 })
  const variant = (await res.json()) as { id: string; label: string }
  return { status: res.status, variant }
}

async function addSize(
  variantId: string,
  opts: { size?: string; priceCents?: number; stock?: number } = {},
) {
  const { size = 'M', priceCents = 1500, stock = 10 } = opts
  const res = await adminPost('/api/admin/products/sizes', {
    variantId,
    size,
    priceCents,
    stock,
    active: true,
  })
  const sizeOption = (await res.json()) as {
    id: string
    size: string
    priceCents: number
    stock: number
  }
  return { status: res.status, sizeOption }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/admin/products', () => {
  it('creates a product and returns it (201)', async () => {
    const { status, product } = await createProduct({
      name: 'Admin Tee',
      description: 'A test product',
    })
    expect(status).toBe(201)
    expect(product.id).toBeTruthy()
    expect(product.name).toBe('Admin Tee')
  })

  it('product is active by default', async () => {
    const { product } = await createProduct({ name: 'Default Active' })
    expect(product.active).toBe(true)
  })

  it('can create an inactive product', async () => {
    const { status, product } = await createProduct({ name: 'Inactive Product', active: false })
    expect(status).toBe(201)
    expect(product.active).toBe(false)
  })

  it('rejects missing name (400)', async () => {
    const res = await adminPost('/api/admin/products', { description: 'No name' })
    expect(res.status).toBe(400)
  })
})

describe('GET /api/admin/products', () => {
  it('returns empty list when no products', async () => {
    const res = await get('/api/admin/products')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { products: unknown[] }
    expect(body.products).toHaveLength(0)
  })

  it('includes inactive products (unlike public route)', async () => {
    await createProduct({ name: 'Active Product', active: true })
    await createProduct({ name: 'Inactive Product', active: false })

    const res = await get('/api/admin/products')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { products: Array<{ product: { name: string } }> }
    expect(body.products).toHaveLength(2)
  })

  it('public /api/products only shows active', async () => {
    await createProduct({ name: 'Active Tee', active: true })
    await createProduct({ name: 'Hidden Tee', active: false })

    const res = await get('/api/products')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { products: Array<{ product: { name: string } }> }
    expect(body.products).toHaveLength(1)
    expect(body.products[0].product.name).toBe('Active Tee')
  })
})

describe('GET /api/admin/products/:id', () => {
  it('returns product by id', async () => {
    const { product } = await createProduct({ name: 'Fetch Me' })
    const res = await get(`/api/admin/products/${product.id}`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { product: { id: string; name: string } }
    expect(body.product.id).toBe(product.id)
    expect(body.product.name).toBe('Fetch Me')
  })

  it('returns inactive product (admin can re-activate it)', async () => {
    const { product } = await createProduct({ name: 'Was Hidden', active: false })
    const res = await get(`/api/admin/products/${product.id}`)
    expect(res.status).toBe(200)
  })

  it('returns 404 for non-existent id', async () => {
    const res = await get('/api/admin/products/doesnotexist')
    expect(res.status).toBe(404)
  })
})

describe('PUT /api/admin/products/:id', () => {
  it('updates product name', async () => {
    const { product } = await createProduct({ name: 'Old Name' })
    const res = await adminPut(`/api/admin/products/${product.id}`, { name: 'New Name' })
    expect(res.status).toBe(200)
    const updated = (await res.json()) as { name: string }
    expect(updated.name).toBe('New Name')
  })

  it('can deactivate a product', async () => {
    const { product } = await createProduct({ name: 'Active', active: true })
    const res = await adminPut(`/api/admin/products/${product.id}`, { active: false })
    expect(res.status).toBe(200)
    const updated = (await res.json()) as { active: boolean }
    expect(updated.active).toBe(false)
  })

  it('returns 404 for non-existent product', async () => {
    const res = await adminPut('/api/admin/products/ghost', { name: 'Ghost' })
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/admin/products/:id', () => {
  it('soft-deletes a product (sets active=false)', async () => {
    const { product } = await createProduct({ name: 'To Delete' })
    const delRes = await adminDelete(`/api/admin/products/${product.id}`)
    expect(delRes.status).toBe(200)

    const row = await db()
      .select({ active: schema.products.active })
      .from(schema.products)
      .where(eq(schema.products.id, product.id))
      .get()
    expect(row?.active).toBe(false)
  })

  it('returns 404 for non-existent product', async () => {
    const res = await adminDelete('/api/admin/products/nope')
    expect(res.status).toBe(404)
  })
})

describe('POST /api/admin/products/variants', () => {
  it('creates a variant for a product (201)', async () => {
    const { product } = await createProduct({ name: 'Tee' })
    const { status, variant } = await addVariant(product.id, 'Red')
    expect(status).toBe(201)
    expect(variant.label).toBe('Red')
    expect(variant.id).toBeTruthy()
  })

  it('returns 404 when product does not exist', async () => {
    const res = await adminPost('/api/admin/products/variants', {
      productId: 'nonexistent',
      label: 'Blue',
      sortOrder: 0,
    })
    expect(res.status).toBe(404)
  })
})

describe('PUT /api/admin/products/variants/:variantId', () => {
  it('updates variant label', async () => {
    const { product } = await createProduct({ name: 'Tee' })
    const { variant } = await addVariant(product.id, 'OldLabel')

    const res = await adminPut(`/api/admin/products/variants/${variant.id}`, { label: 'NewLabel' })
    expect(res.status).toBe(200)
    const updated = (await res.json()) as { label: string }
    expect(updated.label).toBe('NewLabel')
  })

  it('returns 404 for non-existent variant', async () => {
    const res = await adminPut('/api/admin/products/variants/ghost', { label: 'X' })
    expect(res.status).toBe(404)
  })
})

describe('POST /api/admin/products/sizes', () => {
  it('adds a size option to a variant (201)', async () => {
    const { product } = await createProduct({ name: 'Tee' })
    const { variant } = await addVariant(product.id)
    const { status, sizeOption } = await addSize(variant.id, {
      size: 'L',
      priceCents: 2000,
      stock: 8,
    })
    expect(status).toBe(201)
    expect(sizeOption.size).toBe('L')
    expect(sizeOption.priceCents).toBe(2000)
    expect(sizeOption.stock).toBe(8)
  })

  it('returns 404 when variant does not exist', async () => {
    const res = await adminPost('/api/admin/products/sizes', {
      variantId: 'ghost',
      size: 'M',
      priceCents: 1000,
      stock: 5,
      active: true,
    })
    expect(res.status).toBe(404)
  })
})

describe('PUT /api/admin/products/sizes/:sizeId', () => {
  it('updates price and stock of a size option', async () => {
    const { product } = await createProduct({ name: 'Tee' })
    const { variant } = await addVariant(product.id)
    const { sizeOption } = await addSize(variant.id, { priceCents: 1000, stock: 5 })

    const res = await adminPut(`/api/admin/products/sizes/${sizeOption.id}`, {
      priceCents: 1500,
      stock: 10,
    })
    expect(res.status).toBe(200)
    const updated = (await res.json()) as { priceCents: number; stock: number }
    expect(updated.priceCents).toBe(1500)
    expect(updated.stock).toBe(10)
  })

  it('returns 404 for non-existent size option', async () => {
    const res = await adminPut('/api/admin/products/sizes/ghost', { stock: 5 })
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/admin/products/sizes/:sizeId', () => {
  it('deletes a size option', async () => {
    const { product } = await createProduct({ name: 'Tee' })
    const { variant } = await addVariant(product.id)
    const { sizeOption } = await addSize(variant.id)

    const res = await adminDelete(`/api/admin/products/sizes/${sizeOption.id}`)
    expect(res.status).toBe(200)

    const row = await db()
      .select()
      .from(schema.sizeOptions)
      .where(eq(schema.sizeOptions.id, sizeOption.id))
      .get()
    expect(row).toBeUndefined()
  })

  it('returns 404 for non-existent size option', async () => {
    const res = await adminDelete('/api/admin/products/sizes/ghost')
    expect(res.status).toBe(404)
  })
})
