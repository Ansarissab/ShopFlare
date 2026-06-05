// Public category routes — mounted at /api/categories. Read-only, active
// categories only. Admin category CRUD lives on /api/admin/categories.

import { Hono } from 'hono'
import { eq, sql } from 'drizzle-orm'
import { createDb } from 'worker/db/index'
import * as schema from 'worker/db/schema'
import { assembleCategoryTree, getCategoryBySlug, resolveCategoryProductIds } from 'worker/lib/categories'
import { assembleProductList } from 'worker/lib/products'
import { etagFor } from 'worker/lib/fingerprint'
import { getDataVersion } from 'worker/lib/version'
import type { Bindings } from 'worker/types'

const app = new Hono<{ Bindings: Bindings }>()

// ─── GET / — active category tree with product counts ────────────────────────

app.get('/', async (c) => {
  const db = createDb(c.env.DB)

  const [stats, version] = await Promise.all([
    db
      .select({
        count: sql<number>`COUNT(*)`,
        maxUpdatedAt: sql<string>`MAX(updated_at)`,
      })
      .from(schema.categories)
      .where(eq(schema.categories.active, true))
      .get(),
    getDataVersion(db),
  ])

  const etag = etagFor({
    count: stats?.count ?? 0,
    maxUpdatedAt: stats?.maxUpdatedAt ?? '',
    version,
  })

  const cacheControl = 'public, max-age=60, s-maxage=300, stale-while-revalidate=60'

  if (c.req.header('If-None-Match') === etag) {
    return c.newResponse(null, 304, { 'Cache-Control': cacheControl, 'ETag': etag })
  }

  const categories = await assembleCategoryTree(db)
  return c.json({ categories }, 200, {
    'Cache-Control': cacheControl,
    'ETag': etag,
  })
})

// ─── GET /:slug — single active category with products + breadcrumb ───────────

app.get('/:slug', async (c) => {
  const { slug } = c.req.param()
  const db = createDb(c.env.DB)

  const result = await getCategoryBySlug(db, slug)
  if (!result) return c.json({ error: 'Category not found' }, 404)

  const { category, breadcrumb } = result

  // ETag: category updatedAt + version
  const version = await getDataVersion(db)
  const etag = etagFor({ count: 1, maxUpdatedAt: category.updatedAt, version })

  const catDetailCacheControl = 'public, max-age=60, s-maxage=300, stale-while-revalidate=60'

  if (c.req.header('If-None-Match') === etag) {
    return c.newResponse(null, 304, { 'Cache-Control': catDetailCacheControl, 'ETag': etag })
  }

  // Resolve all products in this category + its descendants
  const productIds = await resolveCategoryProductIds(db, category.id, { includeDescendants: true })
  const products = productIds.length > 0
    ? await assembleProductList(db, { productIds })
    : []

  return c.json({ category, products, breadcrumb }, 200, {
    'Cache-Control': catDetailCacheControl,
    'ETag': etag,
  })
})

export default app
