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

// ─── GET /:id — single product by id ─────────────────────────────────────────

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

// ─── Admin stubs (Phase 2) ────────────────────────────────────────────────────

app.post('/', (c) => c.json({ todo: 'create product — Phase 2' }))
app.put('/:id', (c) => c.json({ todo: 'update product — Phase 2' }))
app.delete('/:id', (c) => c.json({ todo: 'delete product — Phase 2' }))
app.post('/sync-stripe', (c) => c.json({ todo: 'sync to stripe — Phase 2' }))

export default app
