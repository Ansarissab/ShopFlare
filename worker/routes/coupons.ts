import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { z } from 'zod/v4'
import { createDb } from '../db/index'
import * as schema from '../db/schema'
import { parseBody } from '../lib/http'
import { evaluateCoupon } from '../lib/orders'
import type { Bindings } from '../types'

const app = new Hono<{ Bindings: Bindings }>()

// ─── Validation schema ────────────────────────────────────────────────────────

const validateCouponSchema = z.object({
  code: z.string().min(1).max(64),
  subtotalCents: z.number().int().nonnegative(),
})

// ─── POST /validate ───────────────────────────────────────────────────────────
/**
 * Validates a coupon code against the current cart subtotal.
 *
 * Applies the same validity rules as createOrder (evaluateCoupon):
 *   - coupon must exist and be active
 *   - not expired
 *   - subtotal meets minOrderCents
 *   - usageLimit not exceeded
 *
 * Response: { valid: boolean, discountCents: number, message?: string }
 * discountCents is 0 when valid is false.
 */
app.post('/validate', async (c) => {
  const [body, errResp] = await parseBody(c)
  if (errResp) return errResp

  const parsed = validateCouponSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 400)
  }

  const { code, subtotalCents } = parsed.data
  const db = createDb(c.env.DB)

  const coupon = await db
    .select()
    .from(schema.coupons)
    .where(eq(schema.coupons.code, code))
    .get() ?? null

  const result = evaluateCoupon(coupon, subtotalCents, new Date().toISOString())

  if (!result.ok) {
    return c.json({ valid: false, discountCents: 0, message: result.message })
  }

  return c.json({ valid: true, discountCents: result.discountCents })
})

export default app
