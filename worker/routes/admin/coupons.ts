// Admin coupon routes — mounted under /api/admin/coupons, behind requireAccess.
// Full CRUD + Stripe coupon/promotion-code sync.

import { Hono } from 'hono'
import { eq, desc } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { createDb } from '../../db/index'
import * as schema from '../../db/schema'
import { createCouponSchema, updateCouponSchema } from '@/lib/schemas'
import { CURRENCIES } from '@/lib/constants'
import { parseBody } from '../../lib/http'
import { createStripe } from '../../lib/stripe'
import type { AdminEnv } from '../../lib/access'

const app = new Hono<AdminEnv>()

// ─── Helpers: store currency + Stripe unit conversion ────────────────────────

// Returns the store currency as a lowercase ISO code (Stripe wants lowercase).
async function getStoreCurrency(db: ReturnType<typeof createDb>): Promise<string> {
  const row = await db
    .select({ value: schema.storeConfig.value })
    .from(schema.storeConfig)
    .where(eq(schema.storeConfig.key, 'currency'))
    .get()
  return (row?.value ?? 'PKR').toLowerCase()
}

// Our amounts are stored as major × 10^(our decimals): e.g. $49.99 → 4999 (2dp),
// but ₨500 → 500 (PKR is 0dp in our CURRENCIES table). Stripe treats ALL of our
// supported currencies as 2-decimal, so convert by 10^(2 - ourDecimals):
// ×100 for 0-decimal display currencies (PKR, BDT), ×1 for the rest.
function toStripeMinorUnits(amount: number, currencyLower: string): number {
  const cur = CURRENCIES[currencyLower.toUpperCase() as keyof typeof CURRENCIES]
  const ourDecimals = cur?.decimals ?? 2
  return Math.round(amount * Math.pow(10, 2 - ourDecimals))
}

// ─── GET / — list all coupons, newest first ──────────────────────────────────

app.get('/', async (c) => {
  const db = createDb(c.env.DB)
  const coupons = await db
    .select()
    .from(schema.coupons)
    .orderBy(desc(schema.coupons.createdAt))
    .all()
  return c.json({ coupons })
})

// ─── POST / — create coupon + Stripe coupon/promotion-code sync ──────────────

app.post('/', async (c) => {
  const [body, errResp] = await parseBody(c)
  if (errResp) return errResp

  const parsed = createCouponSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 400)
  }

  const data = parsed.data
  const db = createDb(c.env.DB)

  // Reject duplicate code (case-sensitive; unique index enforces at DB level too)
  const existing = await db
    .select({ id: schema.coupons.id })
    .from(schema.coupons)
    .where(eq(schema.coupons.code, data.code))
    .get()
  if (existing) {
    return c.json({ error: 'A coupon with this code already exists' }, 409)
  }

  // ── Stripe sync ─────────────────────────────────────────────────────────────
  let stripeCouponId: string | null = null
  let stripePromotionCodeId: string | null = null

  if (c.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = createStripe(c.env.STRIPE_SECRET_KEY)
      const currency = await getStoreCurrency(db) // read once

      // Create Stripe coupon (amounts converted to Stripe minor units)
      const stripeCoupon =
        data.type === 'percentage'
          ? await stripe.coupons.create({
              percent_off: data.value,
              duration: 'forever',
            })
          : await stripe.coupons.create({
              amount_off: toStripeMinorUnits(data.value, currency),
              currency,
              duration: 'forever',
            })

      stripeCouponId = stripeCoupon.id

      // Build promotion code params (Stripe SDK v22: coupon via promotion.coupon)
      const promoParams: Parameters<typeof stripe.promotionCodes.create>[0] = {
        promotion: { type: 'coupon', coupon: stripeCoupon.id },
        code: data.code,
        ...(data.usageLimit != null ? { max_redemptions: data.usageLimit } : {}),
        ...(data.expiresAt ? { expires_at: Math.floor(new Date(data.expiresAt).getTime() / 1000) } : {}),
        ...(data.minOrderCents != null
          ? {
              restrictions: {
                minimum_amount: toStripeMinorUnits(data.minOrderCents, currency),
                minimum_amount_currency: currency,
              },
            }
          : {}),
      }

      const promoCode = await stripe.promotionCodes.create(promoParams)
      stripePromotionCodeId = promoCode.id
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Stripe error'
      return c.json({ error: `Stripe sync failed: ${msg}` }, 502)
    }
  }

  // ── Insert D1 row (only after Stripe succeeds) ───────────────────────────────
  const id = nanoid()
  const now = new Date().toISOString()

  await db.insert(schema.coupons).values({
    id,
    code: data.code,
    type: data.type,
    value: data.value,
    minOrderCents: data.minOrderCents ?? null,
    maxDiscountCents: data.maxDiscountCents ?? null,
    usageLimit: data.usageLimit ?? null,
    perCustomerLimit: data.perCustomerLimit,
    usedCount: 0,
    expiresAt: data.expiresAt ?? null,
    stripeCouponId,
    stripePromotionCodeId,
    active: data.active,
    createdAt: now,
  })

  const coupon = await db
    .select()
    .from(schema.coupons)
    .where(eq(schema.coupons.id, id))
    .get()

  return c.json(coupon, 201)
})

// ─── PUT /:id — update coupon ─────────────────────────────────────────────────
// Stripe coupon amounts are immutable once created. Only the promotion code
// `active` flag is synced when `active` changes.

app.put('/:id', async (c) => {
  const { id } = c.req.param()
  const [body, errResp] = await parseBody(c)
  if (errResp) return errResp

  const parsed = updateCouponSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 400)
  }

  const db = createDb(c.env.DB)

  const coupon = await db
    .select()
    .from(schema.coupons)
    .where(eq(schema.coupons.id, id))
    .get()
  if (!coupon) return c.json({ error: 'Coupon not found' }, 404)

  const data = parsed.data

  // Stripe promo-code active sync
  if (data.active !== undefined && data.active !== coupon.active && coupon.stripePromotionCodeId && c.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = createStripe(c.env.STRIPE_SECRET_KEY)
      await stripe.promotionCodes.update(coupon.stripePromotionCodeId, { active: data.active })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Stripe error'
      return c.json({ error: `Stripe sync failed: ${msg}` }, 502)
    }
  }

  // Build partial update — only defined fields
  const set: Partial<typeof schema.coupons.$inferInsert> = {}
  if (data.code !== undefined) set.code = data.code
  if (data.type !== undefined) set.type = data.type
  if (data.value !== undefined) set.value = data.value
  if (data.minOrderCents !== undefined) set.minOrderCents = data.minOrderCents
  if (data.maxDiscountCents !== undefined) set.maxDiscountCents = data.maxDiscountCents
  if (data.usageLimit !== undefined) set.usageLimit = data.usageLimit
  if (data.perCustomerLimit !== undefined) set.perCustomerLimit = data.perCustomerLimit
  if (data.expiresAt !== undefined) set.expiresAt = data.expiresAt
  if (data.active !== undefined) set.active = data.active

  await db.update(schema.coupons).set(set).where(eq(schema.coupons.id, id))

  const updated = await db
    .select()
    .from(schema.coupons)
    .where(eq(schema.coupons.id, id))
    .get()

  return c.json(updated)
})

// ─── DELETE /:id — soft-delete: deactivate D1 row + Stripe promo code ─────────

app.delete('/:id', async (c) => {
  const { id } = c.req.param()
  const db = createDb(c.env.DB)

  const coupon = await db
    .select()
    .from(schema.coupons)
    .where(eq(schema.coupons.id, id))
    .get()
  if (!coupon) return c.json({ error: 'Coupon not found' }, 404)

  // Deactivate Stripe promotion code if present
  if (coupon.stripePromotionCodeId && c.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = createStripe(c.env.STRIPE_SECRET_KEY)
      await stripe.promotionCodes.update(coupon.stripePromotionCodeId, { active: false })
    } catch {
      // Non-fatal — log and continue; D1 soft-delete still proceeds
    }
  }

  await db
    .update(schema.coupons)
    .set({ active: false })
    .where(eq(schema.coupons.id, id))

  return c.json({ ok: true })
})

export default app
