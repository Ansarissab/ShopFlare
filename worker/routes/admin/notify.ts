// Admin restock-request view — mounted under /api/admin/notify, behind requireAdmin.
// GET / returns aggregated outstanding notify_me rows grouped by sizeOptionId,
// joined to size_options → variants → products. Ordered by waiting count desc.

import { Hono } from 'hono'
import { eq, count, max, desc, sql } from 'drizzle-orm'
import { createDb } from 'worker/db/index'
import * as schema from 'worker/db/schema'
import type { AdminEnv } from 'worker/lib/access'

// The response shape is the client-side NotifyRequest contract (see
// src/lib/types/store.ts). Worker routes return structurally-typed objects
// rather than importing the client type hub (which is not worker-safe), matching
// the convention in routes/admin/orders.ts.

const app = new Hono<AdminEnv>()

// ─── GET / — aggregated outstanding restock requests ────────────────────────

app.get('/', async (c) => {
  const db = createDb(c.env.DB)

  // Aggregate un-notified rows grouped by sizeOptionId.
  // One query: group notify_me, join size_options + variants + products.
  const rows = await db
    .select({
      sizeOptionId: schema.notifyMe.sizeOptionId,
      waiting:        count(schema.notifyMe.id).as('waiting'),
      lastRequestedAt: max(schema.notifyMe.createdAt).as('last_requested_at'),
      // size option fields
      size:    schema.sizeOptions.size,
      stock:   schema.sizeOptions.stock,
      // variant + product
      variantLabel: schema.variants.label,
      productName:  schema.products.name,
    })
    .from(schema.notifyMe)
    .innerJoin(schema.sizeOptions, eq(schema.notifyMe.sizeOptionId, schema.sizeOptions.id))
    .innerJoin(schema.variants,    eq(schema.sizeOptions.variantId, schema.variants.id))
    .innerJoin(schema.products,    eq(schema.variants.productId,    schema.products.id))
    .where(eq(schema.notifyMe.notified, false))
    .groupBy(schema.notifyMe.sizeOptionId)
    .orderBy(desc(sql`waiting`))
    .all()

  const requests = rows.map((r) => ({
    sizeOptionId:   r.sizeOptionId,
    size:           r.size,
    productName:    r.productName,
    variantLabel:   r.variantLabel,
    waiting:        r.waiting,
    lastRequestedAt: r.lastRequestedAt ?? '',
    // stock > 0 or -1 (unlimited) means in-stock
    inStock:        r.stock === -1 || r.stock > 0,
  }))

  return c.json({ requests })
})

export default app
