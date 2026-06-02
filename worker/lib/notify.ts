// Restock-alert dispatch — called when a size option's stock transitions from
// 0 → available (>0 or unlimited). Looks up un-notified notify_me rows,
// sends each subscriber with an email a restock alert, and marks them notified.
//
// Phone-only subscribers (email = null) are intentionally left un-notified
// (notified = false). There is no SMS infrastructure in v1. They remain pending
// so that a future SMS dispatch pass can pick them up by querying
// notified = false WHERE email IS NULL. They are NOT counted in the return value.
//
// NEVER throws — wrapped in try/catch; errors are logged and 0 is returned.

import { eq, and, isNotNull, inArray } from 'drizzle-orm'
import type { Database } from '../db/index'
import * as schema from '../db/schema'
import { sendRestockEmail, sendOrderEmails } from './email'
import { sendPushToAll } from './push'
import type { Bindings } from '../types'
import { en } from '@/lib/i18n/en'

/**
 * Fires the post-order notifications (customer/merchant email + merchant push
 * tickle) for a newly created/confirmed order. Shared by the COD and Stripe
 * paths so the dispatch lives in exactly one place (DRY rule 7).
 *
 * NEVER throws — errors are logged. Intended to be wrapped in
 * executionCtx.waitUntil by the caller so it never blocks the response/ack.
 */
export async function notifyNewOrder(
  db: Database,
  env: Bindings,
  orderId: string,
  orderNumber: string,
): Promise<void> {
  try {
    await sendOrderEmails(db, env, orderId)
    // Payload-less tickle (see worker/lib/push.ts) — SW shows generic copy, so
    // only the order number is passed for the (currently non-transmitted) body.
    await sendPushToAll(db, env, {
      title: en.notifications.newOrderTitle,
      body: orderNumber,
      url: `${env.FRONTEND_URL || ''}/admin/orders`,
    })
  } catch (err) {
    console.warn('[notify] notifyNewOrder error', err)
  }
}

export async function dispatchRestockAlerts(
  db: Database,
  env: Bindings,
  sizeOptionId: string,
): Promise<number> {
  try {
    // ── 1. Load all un-notified rows for this size option that have an email ──
    const rows = await db
      .select()
      .from(schema.notifyMe)
      .where(
        and(
          eq(schema.notifyMe.sizeOptionId, sizeOptionId),
          eq(schema.notifyMe.notified, false),
          isNotNull(schema.notifyMe.email),
        ),
      )
      .all()

    if (rows.length === 0) return 0

    // ── 2. Resolve sizeOption → variant → product ─────────────────────────────
    const sizeOption = await db
      .select({ size: schema.sizeOptions.size, variantId: schema.sizeOptions.variantId })
      .from(schema.sizeOptions)
      .where(eq(schema.sizeOptions.id, sizeOptionId))
      .get()

    if (!sizeOption) {
      console.error(`dispatchRestockAlerts: sizeOption ${sizeOptionId} not found`)
      return 0
    }

    const variant = await db
      .select({ productId: schema.variants.productId })
      .from(schema.variants)
      .where(eq(schema.variants.id, sizeOption.variantId))
      .get()

    if (!variant) {
      console.error(`dispatchRestockAlerts: variant for sizeOption ${sizeOptionId} not found`)
      return 0
    }

    const product = await db
      .select({ id: schema.products.id, name: schema.products.name })
      .from(schema.products)
      .where(eq(schema.products.id, variant.productId))
      .get()

    if (!product) {
      console.error(`dispatchRestockAlerts: product for sizeOption ${sizeOptionId} not found`)
      return 0
    }

    // Product URL — use FRONTEND_URL if set; fall back to relative path so
    // emails still contain a usable link in dev when FRONTEND_URL is empty.
    const base = env.FRONTEND_URL ? env.FRONTEND_URL.replace(/\/$/, '') : ''
    const productUrl = `${base}/product/${product.id}`

    // ── 3. Send emails + collect successfully notified ids ────────────────────
    const notifiedIds: string[] = []

    for (const row of rows) {
      // rows were filtered by isNotNull(email) above; guard satisfies TS
      if (!row.email) continue
      try {
        const sent = await sendRestockEmail(env, row.email, product.name, sizeOption.size, productUrl)
        if (sent) {
          notifiedIds.push(row.id)
        }
        // If sendRestockEmail returns false (stub or API failure) we do NOT mark
        // the row as notified — the next dispatch pass will retry.
      } catch (emailErr) {
        console.error(`dispatchRestockAlerts: email send error for row ${row.id}`, emailErr)
      }
    }

    // ── 4. Mark successfully emailed rows as notified (single bulk UPDATE) ────
    if (notifiedIds.length > 0) {
      await db
        .update(schema.notifyMe)
        .set({ notified: true })
        .where(inArray(schema.notifyMe.id, notifiedIds))
    }

    return notifiedIds.length
  } catch (err) {
    console.error('dispatchRestockAlerts: unexpected error', err)
    return 0
  }
}
