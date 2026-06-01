// Public product routes — mounted at /api/products. Read-only, active products
// only. All admin product CRUD (create/update/delete, variants, sizes, images)
// lives on the CF-Access-protected /api/admin/products router.

import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { createDb } from '../db/index'
import * as schema from '../db/schema'
import { assembleProduct, assembleProductList } from '../lib/products'
import type { Bindings } from '../types'

const app = new Hono<{ Bindings: Bindings }>()

// ─── GET / — list all active products with variants/images/sizes ──────────────

app.get('/', async (c) => {
  const db = createDb(c.env.DB)
  // Batched: 4 queries total regardless of catalogue size (see assembleProductList)
  const products = await assembleProductList(db)
  return c.json({ products })
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

  const assembled = await assembleProduct(db, product)
  return c.json(assembled)
})

export default app
