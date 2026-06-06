// Public product routes — mounted at /api/products. Read-only, active products
// only. All admin product CRUD (create/update/delete, variants, sizes, images)
// lives on the CF-Access-protected /api/admin/products router.

import { Hono } from 'hono'
import { eq, sql } from 'drizzle-orm'
import { createDb } from 'worker/db/index'
import * as schema from 'worker/db/schema'
import { assembleProduct, assembleProductList } from 'worker/lib/products'
import { etagFor } from 'worker/lib/fingerprint'
import { getDataVersion } from 'worker/lib/version'
import { edgeCached } from 'worker/lib/edge-cache'
import type { Bindings } from 'worker/types'

const CACHE_CONTROL = 'public, max-age=60, s-maxage=300, stale-while-revalidate=60'

const app = new Hono<{ Bindings: Bindings }>()

// ─── GET / — list all active products with variants/images/sizes ──────────────

app.get('/', async (c) => {
  const db = createDb(c.env.DB)

  const [stats, version] = await Promise.all([
    db
      .select({
        count: sql<number>`COUNT(*)`,
        maxUpdatedAt: sql<string>`MAX(updated_at)`,
      })
      .from(schema.products)
      .where(eq(schema.products.active, true))
      .get(),
    getDataVersion(db),
  ])

  const etag = etagFor({
    count: stats?.count ?? 0,
    maxUpdatedAt: stats?.maxUpdatedAt ?? '',
    version,
  })

  // Batched: 4 queries total regardless of catalogue size (see assembleProductList)
  return edgeCached(c, {
    etag,
    cacheControl: CACHE_CONTROL,
    build: async () => ({ products: await assembleProductList(db) }),
  })
})

// ─── GET /:id — single active product by id ──────────────────────────────────

app.get('/:id', async (c) => {
  const { id } = c.req.param()
  const db = createDb(c.env.DB)

  const product = await db
    .select()
    .from(schema.products)
    .where(eq(schema.products.id, id))
    .get()

  if (!product || !product.active) {
    return c.json({ error: 'Product not found' }, 404)
  }

  const version = await getDataVersion(db)
  const etag = etagFor({ count: 1, maxUpdatedAt: product.updatedAt, version })

  return edgeCached(c, {
    etag,
    cacheControl: CACHE_CONTROL,
    build: () => assembleProduct(db, product),
  })
})

export default app
