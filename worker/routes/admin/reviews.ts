// Admin review moderation — mounted under /api/admin/reviews, behind requireAccess.
//   GET /          list all reviews (pending + approved) with product name
//   PATCH /:id     moderate (approve/unapprove) via moderateReviewSchema
//   DELETE /:id    delete row (+ R2 photo if present)

import { Hono } from 'hono'
import { eq, desc } from 'drizzle-orm'
import { createDb } from '../../db/index'
import * as schema from '../../db/schema'
import { moderateReviewSchema } from '@/lib/schemas'
import { parseBody } from '../../lib/http'
import type { AdminEnv } from '../../lib/access'

const app = new Hono<AdminEnv>()

// ─── GET / — all reviews (pending + approved) newest-first, with product name ──

app.get('/', async (c) => {
  const db = createDb(c.env.DB)

  const rows = await db
    .select({
      id: schema.reviews.id,
      orderId: schema.reviews.orderId,
      productId: schema.reviews.productId,
      customerName: schema.reviews.customerName,
      rating: schema.reviews.rating,
      body: schema.reviews.body,
      photoUrl: schema.reviews.photoUrl,
      photoR2Key: schema.reviews.photoR2Key,
      approved: schema.reviews.approved,
      createdAt: schema.reviews.createdAt,
      productName: schema.products.name,
    })
    .from(schema.reviews)
    .leftJoin(schema.products, eq(schema.reviews.productId, schema.products.id))
    .orderBy(desc(schema.reviews.createdAt))
    .all()

  const reviews = rows.map((r) => ({
    ...r,
    productName: r.productName ?? '(deleted product)',
  }))

  return c.json({ reviews })
})

// ─── PATCH /:id — approve / unapprove ────────────────────────────────────────

app.patch('/:id', async (c) => {
  const { id } = c.req.param()

  const [body, errResp] = await parseBody(c)
  if (errResp) return errResp

  const parsed = moderateReviewSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 400)
  }

  const { approved } = parsed.data
  const db = createDb(c.env.DB)

  const existing = await db
    .select({ id: schema.reviews.id })
    .from(schema.reviews)
    .where(eq(schema.reviews.id, id))
    .get()

  if (!existing) return c.json({ error: 'Review not found' }, 404)

  const updated = await db
    .update(schema.reviews)
    .set({ approved })
    .where(eq(schema.reviews.id, id))
    .returning()

  return c.json({ review: updated[0] })
})

// ─── DELETE /:id — delete row (+ R2 photo if present) ────────────────────────

app.delete('/:id', async (c) => {
  const { id } = c.req.param()
  const db = createDb(c.env.DB)

  const review = await db
    .select({ id: schema.reviews.id, photoR2Key: schema.reviews.photoR2Key })
    .from(schema.reviews)
    .where(eq(schema.reviews.id, id))
    .get()

  if (!review) return c.json({ error: 'Review not found' }, 404)

  // Delete R2 photo first (best-effort — don't block on failure)
  if (review.photoR2Key) {
    try {
      await c.env.R2.delete(review.photoR2Key)
    } catch {
      // Non-fatal — proceed with DB deletion
    }
  }

  await db.delete(schema.reviews).where(eq(schema.reviews.id, id))

  return c.json({ ok: true })
})

export default app
