// Shared order-creation helper used by both COD and Stripe routes.
// Extracted from routes/orders.ts so the logic lives in exactly one place.

import { eq, and, inArray } from 'drizzle-orm'
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateOrderNumber(): string {
  return `ORD-${nanoid(6).toUpperCase()}`
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

  // ── 2. Coupon discount ─────────────────────────────────────────────────────
  let discountCents = 0
  if (couponCode) {
    const coupon = await db
      .select()
      .from(schema.coupons)
      .where(
        and(
          eq(schema.coupons.code, couponCode),
          eq(schema.coupons.active, true),
        ),
      )
      .get()

    if (coupon) {
      if (coupon.type === 'percentage') {
        discountCents = Math.floor((subtotalCents * coupon.value) / 100)
      } else {
        discountCents = coupon.value
      }
      if (coupon.maxDiscountCents) {
        discountCents = Math.min(discountCents, coupon.maxDiscountCents)
      }
    }
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

  return { orderId, orderNumber, subtotalCents, discountCents, totalCents }
}
