// Integration tests for the category taxonomy feature (Plan 13).
// Tests run against the real worker + ephemeral D1 via workerd / miniflare.
// ENVIRONMENT=development activates CF Access dev-bypass (ADMIN_DEV_BYPASS=1).

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

const adminDelete = (path: string) =>
  SELF.fetch(`${BASE}${path}`, { method: 'DELETE' })

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function createCategory(body: Record<string, unknown>) {
  const res = await adminPost('/api/admin/categories', body)
  const json = (await res.json()) as { category: typeof schema.categories.$inferSelect }
  return { status: res.status, category: json.category }
}

async function seedProduct() {
  await db().insert(schema.products).values({ id: 'p1', name: 'Demo Tee', active: true })
  await db().insert(schema.variants).values({ id: 'v1', productId: 'p1', label: 'Black', sortOrder: 0 })
  await db().insert(schema.sizeOptions).values({ id: 's1', variantId: 'v1', size: 'M', priceCents: 1000, stock: 5, active: true })
  return 'p1'
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

beforeEach(async () => {
  for (const t of [
    'product_categories', 'categories',
    'size_options', 'product_images', 'variants', 'products',
  ]) {
    await env.DB.prepare(`DELETE FROM ${t}`).run()
  }
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('category CRUD + slug rules', () => {
  it('creates a category with auto-derived slug', async () => {
    const { status, category } = await createCategory({ name: "Men's Wear" })
    expect(status).toBe(201)
    expect(category.slug).toBe('men-s-wear')
    expect(category.name).toBe("Men's Wear")
    expect(category.active).toBe(true)
  })

  it('creates a category with an explicit slug', async () => {
    const { status, category } = await createCategory({ name: 'Shirts', slug: 'shirts' })
    expect(status).toBe(201)
    expect(category.slug).toBe('shirts')
  })

  it('duplicate slug -> 409', async () => {
    await createCategory({ name: 'Shirts', slug: 'shirts' })
    const res = await adminPost('/api/admin/categories', { name: 'Other Shirts', slug: 'shirts' })
    expect(res.status).toBe(409)
    const body = (await res.json()) as { error: string }
    expect(body.error).toMatch(/slug/i)
  })

  it('auto-slug deduplication: same name -> conflict -> 409', async () => {
    await createCategory({ name: 'Jackets' })
    // same name → same auto-slug 'jackets'
    const res = await adminPost('/api/admin/categories', { name: 'Jackets' })
    expect(res.status).toBe(409)
  })

  it('slug uniqueness check on update -> 409 when taken by another category', async () => {
    const { category: a } = await createCategory({ name: 'Alpha', slug: 'alpha' })
    await createCategory({ name: 'Beta', slug: 'beta' })
    // Try to rename alpha's slug to 'beta'
    const res = await adminPut(`/api/admin/categories/${a.id}`, { slug: 'beta' })
    expect(res.status).toBe(409)
  })

  it('update keeps the same slug without conflict', async () => {
    const { category } = await createCategory({ name: 'Alpha', slug: 'alpha' })
    const res = await adminPut(`/api/admin/categories/${category.id}`, { name: 'Alpha Updated', slug: 'alpha' })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { category: { name: string } }
    expect(body.category.name).toBe('Alpha Updated')
  })
})

describe('category depth rules', () => {
  it('creates a valid parent->child hierarchy (depth 2)', async () => {
    const { category: parent } = await createCategory({ name: 'Men' })
    const { status, category: child } = await createCategory({ name: 'Shirts', parentId: parent.id })
    expect(status).toBe(201)
    expect(child.parentId).toBe(parent.id)
  })

  it('depth violation: parent already has a parent -> 422', async () => {
    const { category: level0 } = await createCategory({ name: 'Level 0' })
    const { category: level1 } = await createCategory({ name: 'Level 1', parentId: level0.id })
    const res = await adminPost('/api/admin/categories', { name: 'Level 2', parentId: level1.id })
    expect(res.status).toBe(422)
  })

  it('self-parent on update -> 422', async () => {
    const { category } = await createCategory({ name: 'Self' })
    const res = await adminPut(`/api/admin/categories/${category.id}`, { parentId: category.id })
    expect(res.status).toBe(422)
  })

  it('setting parentId to a non-existent category -> 422', async () => {
    const res = await adminPost('/api/admin/categories', { name: 'Orphan', parentId: 'nonexistent' })
    expect(res.status).toBe(422)
  })
})

describe('soft-delete behaviour', () => {
  it('soft-deletes a category (active=false)', async () => {
    const { category } = await createCategory({ name: 'Jackets' })
    const res = await adminDelete(`/api/admin/categories/${category.id}`)
    expect(res.status).toBe(200)

    const row = await db()
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.id, category.id))
      .get()
    expect(row?.active).toBe(false)
  })

  it('soft-delete of a parent nulls children parentId but does not delete them', async () => {
    const { category: parent } = await createCategory({ name: 'Parent' })
    const { category: child } = await createCategory({ name: 'Child', parentId: parent.id })

    await adminDelete(`/api/admin/categories/${parent.id}`)

    const childRow = await db()
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.id, child.id))
      .get()
    expect(childRow?.parentId).toBeNull()
    expect(childRow?.active).toBe(true) // child survives, promoted to top-level
  })

  it('inactive category is excluded from public GET /api/categories', async () => {
    const { category } = await createCategory({ name: 'Hidden' })
    await adminDelete(`/api/admin/categories/${category.id}`)

    const res = await get('/api/categories')
    expect(res.status).toBe(200)
    const { categories } = (await res.json()) as { categories: Array<{ id: string }> }
    expect(categories.find((c) => c.id === category.id)).toBeUndefined()
  })

  it('inactive category slug -> 404 on public storefront', async () => {
    const { category } = await createCategory({ name: 'Ghosted', slug: 'ghosted' })
    await adminDelete(`/api/admin/categories/${category.id}`)

    const res = await get('/api/categories/ghosted')
    expect(res.status).toBe(404)
  })
})

describe('product-category assignment', () => {
  it('assigns a product to categories and replaces on update', async () => {
    const productId = await seedProduct()
    const { category: cat1 } = await createCategory({ name: 'Cat1' })
    const { category: cat2 } = await createCategory({ name: 'Cat2' })

    // Assign to cat1
    const r1 = await adminPut(`/api/admin/products/${productId}/categories`, { categoryIds: [cat1.id] })
    expect(r1.status).toBe(200)

    let rows = await db().select().from(schema.productCategories).where(eq(schema.productCategories.productId, productId)).all()
    expect(rows.map((r) => r.categoryId)).toEqual([cat1.id])

    // Re-assign to cat2 only (replaces)
    const r2 = await adminPut(`/api/admin/products/${productId}/categories`, { categoryIds: [cat2.id] })
    expect(r2.status).toBe(200)

    rows = await db().select().from(schema.productCategories).where(eq(schema.productCategories.productId, productId)).all()
    expect(rows.map((r) => r.categoryId)).toEqual([cat2.id])
  })

  it('categoryIds appear on product payload after assignment', async () => {
    const productId = await seedProduct()
    const { category } = await createCategory({ name: 'Tagged' })
    await adminPut(`/api/admin/products/${productId}/categories`, { categoryIds: [category.id] })

    const res = await get('/api/products')
    const { products } = (await res.json()) as { products: Array<{ product: { id: string }; categoryIds: string[] }> }
    const p = products.find((p) => p.product.id === productId)
    expect(p?.categoryIds).toContain(category.id)
  })

  it('assignment bumps data version (ETag changes)', async () => {
    const productId = await seedProduct()
    const { category } = await createCategory({ name: 'VersionTest' })

    const r1 = await get('/api/products')
    const etag1 = r1.headers.get('etag')

    await adminPut(`/api/admin/products/${productId}/categories`, { categoryIds: [category.id] })

    const r2 = await get('/api/products')
    const etag2 = r2.headers.get('etag')

    expect(etag1).toBeTruthy()
    expect(etag2).toBeTruthy()
    expect(etag1).not.toBe(etag2)
  })

  it('clears all category assignments when categoryIds is empty', async () => {
    const productId = await seedProduct()
    const { category } = await createCategory({ name: 'Temp' })
    await adminPut(`/api/admin/products/${productId}/categories`, { categoryIds: [category.id] })
    await adminPut(`/api/admin/products/${productId}/categories`, { categoryIds: [] })

    const rows = await db().select().from(schema.productCategories).where(eq(schema.productCategories.productId, productId)).all()
    expect(rows).toHaveLength(0)
  })
})

describe('/api/categories public routes', () => {
  it('returns empty tree when no categories exist', async () => {
    const res = await get('/api/categories')
    expect(res.status).toBe(200)
    const { categories } = (await res.json()) as { categories: unknown[] }
    expect(categories).toHaveLength(0)
  })

  it('returns top-level categories with nested children', async () => {
    const { category: parent } = await createCategory({ name: 'Parent' })
    await createCategory({ name: 'Child', parentId: parent.id })

    const res = await get('/api/categories')
    const { categories } = (await res.json()) as { categories: Array<{ id: string; children: Array<{ id: string }> }> }

    expect(categories).toHaveLength(1)
    expect(categories[0].id).toBe(parent.id)
    expect(categories[0].children).toHaveLength(1)
  })

  it('GET /api/categories/:slug returns category + breadcrumb', async () => {
    const { category: parent } = await createCategory({ name: 'Men', slug: 'men' })
    const { category: child } = await createCategory({ name: 'Shirts', slug: 'shirts', parentId: parent.id })

    const res = await get('/api/categories/shirts')
    expect(res.status).toBe(200)
    const { category, breadcrumb } = (await res.json()) as {
      category: { id: string }
      breadcrumb: Array<{ id: string }>
    }
    expect(category.id).toBe(child.id)
    expect(breadcrumb.map((b) => b.id)).toEqual([parent.id, child.id])
  })

  it('/api/categories/:slug includes descendant products (parent shows child products)', async () => {
    const productId = await seedProduct()
    const { category: parent } = await createCategory({ name: 'Tops', slug: 'tops' })
    const { category: child } = await createCategory({ name: 'T-Shirts', slug: 't-shirts', parentId: parent.id })

    // Assign product to CHILD category only
    await adminPut(`/api/admin/products/${productId}/categories`, { categoryIds: [child.id] })

    // GET parent slug → should include the child's product
    const res = await get('/api/categories/tops')
    expect(res.status).toBe(200)
    const { products } = (await res.json()) as { products: Array<{ product: { id: string } }> }
    expect(products.map((p) => p.product.id)).toContain(productId)
  })

  it('ETag 304 on repeated request with no changes', async () => {
    await createCategory({ name: 'Cached' })
    const r1 = await get('/api/categories')
    const etag = r1.headers.get('etag')
    expect(etag).toBeTruthy()

    const r2 = await SELF.fetch(`${BASE}/api/categories`, {
      headers: { 'If-None-Match': etag! },
    })
    expect(r2.status).toBe(304)
  })
})
