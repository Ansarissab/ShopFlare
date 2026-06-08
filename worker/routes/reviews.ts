// Public review routes — mounted at /api/reviews.
//   POST /            verified-purchase submit (Turnstile + delivered order gate)
//   GET  /product/:id approved reviews + aggregate { reviews, average, count }

import { Hono } from 'hono'
import { eq, and, desc } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { createDb } from 'worker/db/index'
import * as schema from 'worker/db/schema'
import { submitReviewSchema } from '@/lib/schemas'
import { parseBody } from 'worker/lib/http'
import { verifyTurnstile } from 'worker/lib/turnstile'
import { rateLimit } from 'worker/lib/ratelimit'
import { reviewsAllowed } from 'worker/lib/reviews'
import { en } from '@/lib/i18n/en'
import type { Bindings } from 'worker/types'

const app = new Hono<{ Bindings: Bindings }>()

// ─── POST / — submit a verified-purchase review ───────────────────────────────

// Single generic message for every verification failure (order missing, not
// delivered, contact mismatch, product not in order). Distinct codes/messages
// would let an attacker probe order existence + state by guessing order numbers.
const VERIFY_FAILED = "We couldn't verify a delivered order matching those details"

app.post('/', async (c) => {
  // 1. Per-IP throttle, then Turnstile gate — before any DB work
  const ip = c.req.header('CF-Connecting-IP')
  if (!(await rateLimit(c.env, 'review', ip, { limit: 10, windowSeconds: 60 }))) {
    return c.json({ error: 'Too many requests' }, 429)
  }
  const token = c.req.header('X-Turnstile-Token') ?? null
  const valid = await verifyTurnstile(token, c.env.TURNSTILE_SECRET_KEY, ip, {
    isDevelopment: c.env.ENVIRONMENT === 'development',
  })
  if (!valid) return c.json({ error: 'Security check failed' }, 403)

  // 2. Parse + validate body
  const [body, errResp] = await parseBody(c)
  if (errResp) return errResp

  const parsed = submitReviewSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 400)
  }

  const { orderNumber, contact, productId, customerName, rating, body: reviewBody } = parsed.data
  const db = createDb(c.env.DB)

  // 3. Reviews flag — site-wide OFF or per-product OFF blocks new submissions
  if (!(await reviewsAllowed(db, productId))) {
    return c.json({ error: en.reviews.disabled }, 403)
  }

  // 4. Resolve order
  const order = await db
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.orderNumber, orderNumber))
    .get()

  // 4-6. Verify the order exists, is delivered, the contact matches, and the
  // product was actually in it. All failures return the SAME 403 so the
  // endpoint can't be used to probe order existence/state (see VERIFY_FAILED).
  if (!order || order.status !== 'delivered') {
    return c.json({ error: VERIFY_FAILED }, 403)
  }

  const digitsOnly = (s: string) => s.replace(/\D/g, '')
  const contactLower = contact.trim().toLowerCase()
  const contactDigits = digitsOnly(contact)

  const emailMatch =
    order.customerEmail !== null &&
    order.customerEmail.toLowerCase() === contactLower

  const phoneMatch =
    contactDigits.length > 0 &&
    order.customerPhone !== null &&
    digitsOnly(order.customerPhone).endsWith(contactDigits)

  if (!emailMatch && !phoneMatch) {
    return c.json({ error: VERIFY_FAILED }, 403)
  }

  const orderItem = await db
    .select({ id: schema.orderItems.id })
    .from(schema.orderItems)
    .where(
      and(
        eq(schema.orderItems.orderId, order.id),
        eq(schema.orderItems.productId, productId),
      ),
    )
    .get()

  if (!orderItem) {
    return c.json({ error: VERIFY_FAILED }, 403)
  }

  // 7. Reject duplicate (same orderId + productId)
  const duplicate = await db
    .select({ id: schema.reviews.id })
    .from(schema.reviews)
    .where(
      and(
        eq(schema.reviews.orderId, order.id),
        eq(schema.reviews.productId, productId),
      ),
    )
    .get()

  if (duplicate) {
    return c.json({ error: "You've already reviewed this product for this order" }, 409)
  }

  // 8. Insert — approved=false, pending moderation
  await db.insert(schema.reviews).values({
    id: nanoid(),
    orderId: order.id,
    productId,
    customerName,
    rating,
    body: reviewBody ?? null,
    approved: false,
  })

  return c.json({ ok: true, pending: true }, 201)
})

// ─── GET /product/:productId — approved reviews + aggregate ──────────────────

app.get('/product/:productId', async (c) => {
  const { productId } = c.req.param()
  const db = createDb(c.env.DB)

  // When reviews are disabled for this product (site-wide or per-product),
  // return the empty shape (200) so the response stays cacheable and the UI
  // simply renders nothing — no 403 that would surface as an error in the UI.
  if (!(await reviewsAllowed(db, productId))) {
    return c.json({ reviews: [], average: 0, count: 0 })
  }

  const rows = await db
    .select({
      id: schema.reviews.id,
      customerName: schema.reviews.customerName,
      rating: schema.reviews.rating,
      body: schema.reviews.body,
      createdAt: schema.reviews.createdAt,
    })
    .from(schema.reviews)
    .where(
      and(
        eq(schema.reviews.productId, productId),
        eq(schema.reviews.approved, true),
      ),
    )
    .orderBy(desc(schema.reviews.createdAt))
    .all()

  const count = rows.length
  const average =
    count === 0
      ? 0
      : Math.round((rows.reduce((sum, r) => sum + r.rating, 0) / count) * 10) / 10

  return c.json({ reviews: rows, average, count })
})

export default app
