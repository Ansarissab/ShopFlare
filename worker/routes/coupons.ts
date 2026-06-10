import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { z } from 'zod/v4'
import { createDb } from 'worker/db/index'
import * as schema from 'worker/db/schema'
import { parseBody } from 'worker/lib/http'
import { evaluateCoupon } from 'worker/lib/orders'
import { rateLimit } from 'worker/lib/ratelimit'
import { DEFAULT_CURRENCY } from '@/lib/constants'
import type { CurrencyCode } from '@/lib/constants'
import type { Bindings } from 'worker/types'

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
  // Per-IP throttle — this endpoint reveals whether a code is valid + its
  // discount, so without a throttle it enables coupon-code enumeration.
  // (Turnstile is intentionally NOT required here: coupon-apply happens in the
  // cart, before the Turnstile-gated checkout form mounts.)
  if (
    !(await rateLimit(c.env, 'coupon-validate', c.req.header('CF-Connecting-IP'), {
      limit: 20,
      windowSeconds: 60,
    }))
  ) {
    return c.json({ error: 'Too many requests' }, 429)
  }

  const [body, errResp] = await parseBody(c)
  if (errResp) return errResp

  const parsed = validateCouponSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 400)
  }

  const { code, subtotalCents } = parsed.data
  const db = createDb(c.env.DB)

  // Currency drives the min-order message formatting (0-decimal currencies).
  const currencyRow = await db
    .select({ value: schema.storeConfig.value })
    .from(schema.storeConfig)
    .where(eq(schema.storeConfig.key, 'currency'))
    .get()
  const currency = (currencyRow?.value as CurrencyCode | undefined) ?? DEFAULT_CURRENCY

  const coupon =
    (await db.select().from(schema.coupons).where(eq(schema.coupons.code, code)).get()) ?? null

  const result = evaluateCoupon(coupon, subtotalCents, new Date().toISOString(), currency)

  if (!result.ok) {
    return c.json({ valid: false, discountCents: 0, message: result.message })
  }

  return c.json({ valid: true, discountCents: result.discountCents })
})

export default app
