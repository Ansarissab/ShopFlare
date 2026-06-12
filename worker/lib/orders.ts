// Shared order-creation helper used by both COD and Stripe routes.
// Extracted from routes/orders.ts so the logic lives in exactly one place.

import { eq, and, or, inArray, sql } from 'drizzle-orm'
import { nanoid, customAlphabet } from 'nanoid'
import type { Database } from 'worker/db/index'
import * as schema from 'worker/db/schema'
import { DEFAULT_CURRENCY } from '@/lib/constants'
import type { CurrencyCode } from '@/lib/constants'
import { calculateTax, calculateGrandTotal } from '@/lib/utils/index'
import { formatCents } from './money'
import { rowsChanged } from 'worker/lib/d1'

// ─── Shipping config helper ────────────────────────────────────────────────────

interface OrderConfig {
  flatRateCents: number
  thresholdCents: number
  currency: CurrencyCode
  taxEnabled: boolean
  taxRate: number
  taxInclusive: boolean
  taxBasis: string
  taxName: string
}

/**
 * Reads shipping config + currency from store_config in one query.
 * Mirrors the key-read approach in routes/config.ts; Number() converts the
 * stored text value and falls back to 0 on missing / NaN. Currency drives the
 * coupon min-order message formatting (0-decimal currencies like PKR/BDT).
 */
async function getOrderConfig(db: Database): Promise<OrderConfig> {
  const rows = await db
    .select()
    .from(schema.storeConfig)
    .where(
      inArray(schema.storeConfig.key, [
        'flatShippingRateCents',
        'freeShippingThresholdCents',
        'currency',
        'taxEnabled',
        'taxRate',
        'taxInclusive',
        'taxBasis',
        'taxName',
      ]),
    )
    .all()

  const kv: Record<string, string> = {}
  for (const row of rows) {
    kv[row.key] = row.value
  }

  const currency = (kv['currency'] as CurrencyCode | undefined) ?? DEFAULT_CURRENCY

  return {
    flatRateCents: Math.max(0, Number(kv['flatShippingRateCents'] ?? '0') || 0),
    thresholdCents: Math.max(0, Number(kv['freeShippingThresholdCents'] ?? '0') || 0),
    currency,
    taxEnabled: kv['taxEnabled'] === 'true',
    taxRate: Math.max(0, Number(kv['taxRate'] ?? '0') || 0),
    taxInclusive: kv['taxInclusive'] === 'true',
    taxBasis: kv['taxBasis'] ?? 'subtotal',
    taxName: kv['taxName'] || 'Tax',
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type PaymentMethod = (typeof schema.orders.$inferInsert)['paymentMethod']

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
  shippingCents: number
  taxCents: number
  taxName: string
  taxRate: number
  taxInclusive: boolean
  totalCents: number
  currency: CurrencyCode
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

/**
 * Thrown by assertItemsAvailable when a line item references a missing/inactive
 * sizeOption or there isn't enough stock. Routes map it to a 422 response.
 */
export class StockError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StockError'
  }
}

/**
 * Validates that every item references an existing, active sizeOption with
 * sufficient stock (stock === -1 means unlimited). Shared by the COD and POS
 * routes so both fail fast with a typed StockError before createOrder runs.
 * Batched — one query for the whole cart.
 */
export async function assertItemsAvailable(db: Database, items: CreateOrderItem[]): Promise<void> {
  const ids = items.map((i) => i.sizeOptionId)
  const rows = ids.length
    ? await db.select().from(schema.sizeOptions).where(inArray(schema.sizeOptions.id, ids)).all()
    : []

  const byId = new Map(rows.map((s) => [s.id, s]))

  for (const item of items) {
    const sizeOpt = byId.get(item.sizeOptionId)
    if (!sizeOpt || !sizeOpt.active) {
      throw new StockError(`Size option not found: ${item.sizeOptionId}`)
    }
    if (sizeOpt.stock !== -1 && sizeOpt.stock < item.quantity) {
      throw new StockError(`Insufficient stock for size: ${sizeOpt.size}`)
    }
  }
}

export type EvaluateCouponResult =
  | { ok: true; discountCents: number }
  | { ok: false; message: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Crockford-style uppercase alphabet (no I/O/0/1/U to avoid ambiguity and
// accidental words). 8 chars over 31 symbols ≈ 8.5e11 keyspace — human-readable
// AND infeasible to enumerate, unlike `nanoid(6).toUpperCase()` whose
// upper-casing collapsed the alphabet to ~38 symbols (~3e9).
const orderNumberId = customAlphabet('ABCDEFGHJKMNPQRSTVWXYZ23456789', 8)

function generateOrderNumber(): string {
  return `ORD-${orderNumberId()}`
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
 * @param currency - Store currency, used only to format the min-order message
 *   (0-decimal currencies like PKR/BDT must not be divided by 100).
 */
export function evaluateCoupon(
  coupon: typeof schema.coupons.$inferSelect | null | undefined,
  subtotalCents: number,
  now: string,
  currency: CurrencyCode = DEFAULT_CURRENCY,
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
      message: `Minimum order of ${formatCents(coupon.minOrderCents, currency)} required for this coupon`,
    }
  }

  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    return { ok: false, message: 'Coupon usage limit reached' }
  }

  let discountCents =
    coupon.type === 'percentage' ? Math.floor((subtotalCents * coupon.value) / 100) : coupon.value

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
    ? await db.select().from(schema.variants).where(inArray(schema.variants.id, variantIds)).all()
    : []

  const variantMap = new Map(variantRows.map((v) => [v.id, v]))

  // Collect productIds from the fetched variants
  const productIds = [...new Set(variantRows.map((v) => v.productId))]

  // Batch: all products for those productIds
  const productRows = productIds.length
    ? await db.select().from(schema.products).where(inArray(schema.products.id, productIds)).all()
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
  const firstImageMap = new Map<string, (typeof imageRows)[number]>()
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

  // ── 2. Store config (currency + shipping) — one query, reused below ───────
  const {
    flatRateCents,
    thresholdCents,
    currency,
    taxEnabled,
    taxRate,
    taxInclusive,
    taxBasis,
    taxName,
  } = await getOrderConfig(db)

  // ── 2a. Coupon validation + discount ──────────────────────────────────────
  let discountCents = 0
  let couponRow: typeof schema.coupons.$inferSelect | null = null

  if (couponCode) {
    couponRow =
      (await db.select().from(schema.coupons).where(eq(schema.coupons.code, couponCode)).get()) ??
      null

    const result = evaluateCoupon(couponRow, subtotalCents, new Date().toISOString(), currency)

    if (!result.ok) {
      // CouponError is caught by the COD route and mapped to 422
      throw new CouponError(result.message)
    }

    // Per-customer usage limit. Only enforceable when we know the customer's
    // contact at creation time (COD/POS). The Stripe path creates the order with
    // empty contact, so this guard is skipped at session-creation time. The real
    // customer email arrives via session.customer_details in the
    // checkout.session.completed webhook (stripe.ts), which backfills
    // coupon_uses.customerEmail so future orders by the same customer are
    // correctly counted against the per-customer limit.
    if (couponRow && (customerEmail || customerPhone)) {
      const contactConds = [
        customerEmail ? eq(schema.couponUses.customerEmail, customerEmail) : undefined,
        customerPhone ? eq(schema.couponUses.customerPhone, customerPhone) : undefined,
      ].filter(Boolean) as ReturnType<typeof eq>[]

      const prior = await db
        .select({ n: sql<number>`count(*)` })
        .from(schema.couponUses)
        .where(and(eq(schema.couponUses.couponId, couponRow.id), or(...contactConds)))
        .get()

      if ((prior?.n ?? 0) >= couponRow.perCustomerLimit) {
        throw new CouponError('Coupon usage limit reached for this customer')
      }
    }

    discountCents = result.discountCents
  }

  // ── 2b. Shipping — mirrors client's calculateShipping logic ───────────────
  // Free if threshold is set AND subtotal (before discount) meets/exceeds it.
  const shippingCents = thresholdCents > 0 && subtotalCents >= thresholdCents ? 0 : flatRateCents

  const taxCents = taxEnabled
    ? calculateTax({ subtotalCents, shippingCents, discountCents, taxRate, taxInclusive, taxBasis })
    : 0

  const totalCents = calculateGrandTotal(
    subtotalCents,
    shippingCents,
    discountCents,
    taxCents,
    taxInclusive,
  )
  const orderId = nanoid()
  const orderNumber = generateOrderNumber()

  // ── 3. Stock decrement — ATOMIC conditional reserve (prevents oversell) ───
  // Run the stock-reservation loop BEFORE writing any order rows. This means a
  // mid-reservation failure only needs to reverse the stock — there is nothing
  // to delete from the orders/order_items tables yet, which eliminates the
  // window where a partial order header + some items could be left behind if the
  // worker is evicted between the header insert and the full items loop.
  //
  // The decrement only succeeds where `stock >= quantity`, so two orders racing
  // for the last units can't both win: the loser's UPDATE matches 0 rows
  // (meta.changes !== 1). On a loss we roll back the units already reserved in
  // this call, then surface a StockError.
  // Unlimited (-1) items are skipped — they never need reserving.
  const reserved: Array<{ sizeOptionId: string; quantity: number }> = []
  for (const item of items) {
    const so = sizeOptionMap.get(item.sizeOptionId)
    if (!so || so.stock === -1) continue

    const res = await db
      .update(schema.sizeOptions)
      .set({ stock: sql`${schema.sizeOptions.stock} - ${item.quantity}` })
      .where(
        and(
          eq(schema.sizeOptions.id, item.sizeOptionId),
          sql`${schema.sizeOptions.stock} != -1`,
          sql`${schema.sizeOptions.stock} >= ${item.quantity}`,
        ),
      )

    if (rowsChanged(res) === 1) {
      reserved.push({ sizeOptionId: item.sizeOptionId, quantity: item.quantity })
      continue
    }

    // Lost the race — restore what we reserved (no order rows exist yet), then throw.
    for (const r of reserved) {
      await db
        .update(schema.sizeOptions)
        .set({ stock: sql`${schema.sizeOptions.stock} + ${r.quantity}` })
        .where(eq(schema.sizeOptions.id, r.sizeOptionId))
    }
    throw new StockError(`Insufficient stock for size: ${so.size}`)
  }

  // ── 4. Atomic insert — order header + all items + coupon_uses ─────────────
  // All stock is reserved above. Now commit the order rows atomically: D1's
  // batch() wraps all statements in a single transaction, so the database never
  // contains a partial order (header without items, or items without header).
  // If the batch fails, the reserved stock stays decremented — releaseOrderInventory
  // cannot be called because no order row exists, so we add a best-effort
  // stock reversal here before re-throwing.
  const orderHeaderInsert = db.insert(schema.orders).values({
    id: orderId,
    orderNumber,
    status: 'pending',
    paymentMethod,
    customerName,
    customerEmail: customerEmail ?? null,
    customerPhone: customerPhone ?? null,
    shippingAddress: shippingAddress ? JSON.stringify(shippingAddress) : null,
    subtotalCents,
    shippingCents,
    discountCents,
    taxCents,
    totalCents,
    couponCode: couponCode ?? null,
  })

  const orderItemInserts = orderItemsToInsert.map((item) =>
    db.insert(schema.orderItems).values({ ...item, orderId }),
  )

  const couponUsesInsert =
    couponCode && couponRow
      ? db.insert(schema.couponUses).values({
          id: nanoid(),
          couponId: couponRow.id,
          orderId,
          customerEmail: customerEmail ?? null,
          customerPhone: customerPhone ?? null,
        })
      : null

  const batchStatements = [
    orderHeaderInsert,
    ...orderItemInserts,
    ...(couponUsesInsert ? [couponUsesInsert] : []),
  ] as Parameters<typeof db.batch>[0]

  try {
    await db.batch(batchStatements)
  } catch (err) {
    // Batch failed — no order row written, so we must reverse the stock
    // reservations manually before bubbling the error.
    for (const r of reserved) {
      await db
        .update(schema.sizeOptions)
        .set({ stock: sql`${schema.sizeOptions.stock} + ${r.quantity}` })
        .where(eq(schema.sizeOptions.id, r.sizeOptionId))
    }
    throw err
  }

  // ── 5. Increment coupon usedCount (non-transactional counter) ─────────────
  // This is a denormalised counter updated after the atomic batch. A crash here
  // leaves usedCount one behind — evaluateCoupon re-checks coupon_uses rows for
  // the per-customer limit, so the counter being slightly stale is not a
  // correctness risk for the per-customer check. The global usageLimit check uses
  // usedCount directly; under extreme failure conditions it could allow one extra
  // use, which is acceptable given that the coupon_uses row IS committed above.
  if (couponCode && couponRow) {
    await db
      .update(schema.coupons)
      .set({ usedCount: sql`used_count + 1` })
      .where(eq(schema.coupons.id, couponRow.id))
  }

  return {
    orderId,
    orderNumber,
    subtotalCents,
    discountCents,
    shippingCents,
    taxCents,
    taxName,
    taxRate,
    taxInclusive,
    totalCents,
    currency,
  }
}

// ─── releaseOrderInventory ─────────────────────────────────────────────────────

/**
 * Reverses the stock reservation + coupon usage that createOrder recorded for
 * one order. Called when a reserved order is cancelled (Stripe checkout expired,
 * or a public/COD cancellation) so the held inventory + coupon quota return to
 * the pool — otherwise abandoned checkouts permanently leak stock and burn
 * usage limits.
 *
 * NOT idempotent: it adds stock back unconditionally, so callers MUST invoke it
 * exactly once, gated on a real (still-reserved → cancelled) status transition.
 * The Stripe webhook gates on the cancel UPDATE's `meta.changes`; the public
 * cancel route gates on the pre-read order status.
 */
export async function releaseOrderInventory(db: Database, orderId: string): Promise<void> {
  // 1. Restore stock for each line item (skip unlimited -1, mirroring createOrder).
  const itemRows = await db
    .select({
      sizeOptionId: schema.orderItems.sizeOptionId,
      quantity: schema.orderItems.quantity,
    })
    .from(schema.orderItems)
    .where(eq(schema.orderItems.orderId, orderId))
    .all()

  for (const item of itemRows) {
    await db
      .update(schema.sizeOptions)
      .set({ stock: sql`${schema.sizeOptions.stock} + ${item.quantity}` })
      .where(
        and(eq(schema.sizeOptions.id, item.sizeOptionId), sql`${schema.sizeOptions.stock} != -1`),
      )
  }

  // 2. Reverse coupon usage — decrement usedCount (floor 0) per recorded use,
  //    then delete the coupon_uses rows for this order.
  const useRows = await db
    .select({ couponId: schema.couponUses.couponId })
    .from(schema.couponUses)
    .where(eq(schema.couponUses.orderId, orderId))
    .all()

  for (const use of useRows) {
    await db
      .update(schema.coupons)
      .set({ usedCount: sql`MAX(0, used_count - 1)` })
      .where(eq(schema.coupons.id, use.couponId))
  }

  if (useRows.length > 0) {
    await db.delete(schema.couponUses).where(eq(schema.couponUses.orderId, orderId))
  }
}
