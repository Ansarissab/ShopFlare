// Shared order-creation helper used by both COD and Stripe routes.
// Extracted from routes/orders.ts so the logic lives in exactly one place.

import { eq, and, inArray, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import type { Database } from '../db/index'
import * as schema from '../db/schema'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PaymentMethod = typeof schema.orders.$inferInsert['paymentMethod']

export interface CreateOrderItem {
  /** sizeOption PK — used to look up price + snapshot data */
  sizeOptionId: string
  quantity: number
}

export interface CreateOrderInput {
  paymentMethod: PaymentMethod
  items: CreateOrderItem[]
  /**
   * Customer / shipping fields — optional for Stripe orders where the
   * webhook fills them in after checkout.session.completed fires.
   */
  customerName?: string
  customerEmail?: string
  customerPhone?: string
  shippingAddress?: Record<string, unknown>
  couponCode?: string
}

export interface CreateOrderResult {
  orderId: string
  orderNumber: string
  subtotalCents: number
  discountCents: number
  totalCents: number
}

/**
 * Typed coupon-validation error returned by evaluateCoupon when the coupon
 * cannot be applied. The route turns this into a 422 response.
 *
 * Design choice: evaluateCoupon uses a discriminated-union return value
 * ({ ok: true, discountCents } | { ok: false, message }) rather than
 * throwing.  The caller (createOrder / coupons route) maps the failure
 * branch to a 422 without requiring a try/catch.  createOrder re-throws
 * with a typed CouponError so the COD route can surface it cleanly.
 */
export class CouponError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CouponError'
  }
}

export type EvaluateCouponResult =
  | { ok: true; discountCents: number }
  | { ok: false; message: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateOrderNumber(): string {
  return `ORD-${nanoid(6).toUpperCase()}`
}

/**
 * evaluateCoupon — pure validation + discount computation.
 *
 * Checks all validity rules (active, not expired, min-order, usage-limit)
 * and computes discountCents.  Does NOT write to the DB.
 * Used by both createOrder and POST /api/coupons/validate.
 *
 * @param coupon - Row from the `coupons` table (null means not found).
 * @param subtotalCents - Cart subtotal BEFORE discount.
 * @param now - Injected timestamp string (ISO-8601) for testability.
 */
export function evaluateCoupon(
  coupon: typeof schema.coupons.$inferSelect | null | undefined,
  subtotalCents: number,
  now: string,
): EvaluateCouponResult {
  if (!coupon || !coupon.active) {
    return { ok: false, message: 'Coupon not found or inactive' }
  }

  if (coupon.expiresAt && coupon.expiresAt < now) {
    return { ok: false, message: 'Coupon has expired' }
  }

  if (coupon.minOrderCents !== null && subtotalCents < coupon.minOrderCents) {
    return {
      ok: false,
      message: `Minimum order of ${(coupon.minOrderCents / 100).toFixed(2)} required for this coupon`,
    }
  }

  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    return { ok: false, message: 'Coupon usage limit reached' }
  }

  let discountCents =
    coupon.type === 'percentage'
      ? Math.floor((subtotalCents * coupon.value) / 100)
      : coupon.value

  if (coupon.maxDiscountCents !== null) {
    discountCents = Math.min(discountCents, coupon.maxDiscountCents)
  }

  return { ok: true, discountCents }
}

// ─── createOrder ─────────────────────────────────────────────────────────────

/**
 * Builds and inserts one order + its items.
 *
 * Stock checking is intentionally NOT done here — the COD route performs it
 * before calling this function (user-facing stock check). Stripe relies on
 * Stripe's own inventory controls, so we skip it there.
 *
 * Batched queries (was 3–4 SELECTs per cart item → now 4 total):
 *   1. inArray(sizeOptions, all sizeOptionIds)
 *   2. inArray(variants, all variantIds from step 1)
 *   3. inArray(products, all productIds from step 2)
 *   4. inArray(productImages, all variantIds from step 1) — first image per variant
 *
 * Throws CouponError if the coupon fails validation — the COD route maps
 * this to a 422 response.
 */
export async function createOrder(
  db: Database,
  input: CreateOrderInput,
): Promise<CreateOrderResult> {
  const {
    paymentMethod,
    items,
    customerName = '',
    customerEmail,
    customerPhone,
    shippingAddress,
    couponCode,
  } = input

  // ── 1. Build item snapshots + compute subtotal ─────────────────────────────

  const sizeOptionIds = items.map((i) => i.sizeOptionId)

  // Batch: all sizeOptions for the cart in one query
  const sizeOptionRows = sizeOptionIds.length
    ? await db
        .select()
        .from(schema.sizeOptions)
        .where(inArray(schema.sizeOptions.id, sizeOptionIds))
        .all()
    : []

  const sizeOptionMap = new Map(sizeOptionRows.map((s) => [s.id, s]))

  // Collect variantIds from the fetched sizeOptions
  const variantIds = [...new Set(sizeOptionRows.map((s) => s.variantId))]

  // Batch: all variants for those variantIds
  const variantRows = variantIds.length
    ? await db
        .select()
        .from(schema.variants)
        .where(inArray(schema.variants.id, variantIds))
        .all()
    : []

  const variantMap = new Map(variantRows.map((v) => [v.id, v]))

  // Collect productIds from the fetched variants
  const productIds = [...new Set(variantRows.map((v) => v.productId))]

  // Batch: all products for those productIds
  const productRows = productIds.length
    ? await db
        .select()
        .from(schema.products)
        .where(inArray(schema.products.id, productIds))
        .all()
    : []

  const productMap = new Map(productRows.map((p) => [p.id, p]))

  // Batch: first image per variant — fetch all images for the variant set,
  // then keep the one with the lowest sortOrder per variantId
  const imageRows = variantIds.length
    ? await db
        .select()
        .from(schema.productImages)
        .where(inArray(schema.productImages.variantId, variantIds))
        .all()
    : []

  // Build Map<variantId, firstImage> — smallest sortOrder wins
  const firstImageMap = new Map<string, typeof imageRows[number]>()
  for (const img of imageRows) {
    const existing = firstImageMap.get(img.variantId)
    if (!existing || img.sortOrder < existing.sortOrder) {
      firstImageMap.set(img.variantId, img)
    }
  }

  // Assemble order items using in-memory Maps (no further DB calls)
  let subtotalCents = 0
  const orderItemsToInsert: (typeof schema.orderItems.$inferInsert)[] = []

  for (const item of items) {
    const sizeOpt = sizeOptionMap.get(item.sizeOptionId)
    if (!sizeOpt) continue

    const variant = variantMap.get(sizeOpt.variantId)
    const product = variant ? productMap.get(variant.productId) : null
    const firstImage = firstImageMap.get(sizeOpt.variantId)

    subtotalCents += sizeOpt.priceCents * item.quantity

    orderItemsToInsert.push({
      id: nanoid(),
      orderId: '', // filled after order insert
      sizeOptionId: item.sizeOptionId,
      productId: product?.id ?? '',
      variantId: sizeOpt.variantId,
      quantity: item.quantity,
      priceCents: sizeOpt.priceCents,
      snapshot: JSON.stringify({
        productName: product?.name ?? '',
        variantLabel: variant?.label ?? '',
        size: sizeOpt.size,
        sku: sizeOpt.sku ?? undefined,
        imageUrl: firstImage?.url ?? '',
      }),
    })
  }

  // ── 2. Coupon validation + discount ───────────────────────────────────────
  let discountCents = 0
  let couponRow: typeof schema.coupons.$inferSelect | null = null

  if (couponCode) {
    couponRow = await db
      .select()
      .from(schema.coupons)
      .where(eq(schema.coupons.code, couponCode))
      .get() ?? null

    const result = evaluateCoupon(couponRow, subtotalCents, new Date().toISOString())

    if (!result.ok) {
      // CouponError is caught by the COD route and mapped to 422
      throw new CouponError(result.message)
    }

    discountCents = result.discountCents
  }

  const totalCents = Math.max(0, subtotalCents - discountCents)
  const orderId = nanoid()
  const orderNumber = generateOrderNumber()

  // ── 3. Insert order row ────────────────────────────────────────────────────
  await db.insert(schema.orders).values({
    id: orderId,
    orderNumber,
    status: 'pending',
    paymentMethod,
    customerName,
    customerEmail: customerEmail ?? null,
    customerPhone: customerPhone ?? null,
    shippingAddress: shippingAddress
      ? JSON.stringify(shippingAddress)
      : null,
    subtotalCents,
    shippingCents: 0,
    discountCents,
    totalCents,
    couponCode: couponCode ?? null,
  })

  // ── 4. Insert order items ──────────────────────────────────────────────────
  for (const item of orderItemsToInsert) {
    await db.insert(schema.orderItems).values({ ...item, orderId })
  }

  // ── 5. Stock decrement — skip unlimited (-1) items ────────────────────────
  for (const item of items) {
    await db
      .update(schema.sizeOptions)
      .set({ stock: sql`stock - ${item.quantity}` })
      .where(
        and(
          eq(schema.sizeOptions.id, item.sizeOptionId),
          // Drizzle doesn't have sql != -1 shorthand; use ne via raw sql guard
          sql`${schema.sizeOptions.stock} != -1`,
        ),
      )
  }

  // ── 6. Record coupon usage + increment usedCount ──────────────────────────
  if (couponCode && couponRow) {
    await db.insert(schema.couponUses).values({
      id: nanoid(),
      couponId: couponRow.id,
      orderId,
      customerEmail: customerEmail ?? null,
      customerPhone: customerPhone ?? null,
    })

    await db
      .update(schema.coupons)
      .set({ usedCount: sql`used_count + 1` })
      .where(eq(schema.coupons.id, couponRow.id))
  }

  return { orderId, orderNumber, subtotalCents, discountCents, totalCents }
}
