import { Hono } from 'hono'
import { eq, and, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { createStripe } from 'worker/lib/stripe'
import { createDb } from 'worker/db/index'
import * as schema from 'worker/db/schema'
import { createCheckoutSessionSchema } from '@/lib/schemas'
import { createOrder, releaseOrderInventory, StockError, CouponError } from 'worker/lib/orders'
import { parseBody } from 'worker/lib/http'
import { verifyTurnstile } from 'worker/lib/turnstile'
import { rateLimit } from 'worker/lib/ratelimit'
import { notifyNewOrder } from 'worker/lib/notify'
import { rowsChanged } from 'worker/lib/d1'
import type { Bindings } from 'worker/types'

const app = new Hono<{ Bindings: Bindings }>()

// ─── Validation schema ────────────────────────────────────────────────────────

// Client sends { items, couponCode? } — no orderId (we create the order here
// before calling Stripe so the webhook has an order row to confirm).
// Derive from the shared schema to stay DRY; just omit the now-server-side orderId.
const checkoutBodySchema = createCheckoutSessionSchema.omit({ orderId: true })

// ─── POST /checkout-session ───────────────────────────────────────────────────

app.post('/checkout-session', async (c) => {
  // 0. Abuse controls — creating a session reserves stock + coupon quota (the
  //    pending order is created below), so this endpoint must be throttled and
  //    Turnstile-gated exactly like the COD path. Without it, an anonymous
  //    caller could loop here to drain inventory / burn coupon limits before
  //    any session expires. Mirrors routes/orders.ts POST /cod.
  const ip = c.req.header('CF-Connecting-IP')
  if (!(await rateLimit(c.env, 'checkout', ip, { limit: 10, windowSeconds: 60 }))) {
    return c.json({ error: 'Too many requests' }, 429)
  }
  const token = c.req.header('X-Turnstile-Token') ?? null
  const valid = await verifyTurnstile(token, c.env.TURNSTILE_SECRET_KEY, ip, {
    isDevelopment: c.env.ENVIRONMENT === 'development',
  })
  if (!valid) return c.json({ error: 'Security check failed' }, 403)

  // 1. Parse + validate body
  const [body, errResp] = await parseBody(c)
  if (errResp) return errResp

  const parsed = checkoutBodySchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation error', issues: parsed.error.issues }, 400)
  }

  const { items, couponCode } = parsed.data

  const stripe = createStripe(c.env.STRIPE_SECRET_KEY)
  const db = createDb(c.env.DB)

  // 2. Create a PENDING order row BEFORE calling Stripe, so the webhook's
  //    `UPDATE orders WHERE id = orderId` has a row to land on.
  //
  //    Stripe items only carry { stripePriceId, quantity } — no sizeOptionId.
  //    We look up the sizeOption by stripePriceId so we can build proper
  //    snapshots. Items whose stripePriceId has no matching sizeOption are
  //    still included in the Stripe session but skipped in the order row
  //    (snapshot data is unavailable); this is an edge case — all active
  //    prices should have a matching sizeOption in D1.
  const orderItems: Array<{ sizeOptionId: string; quantity: number }> = []

  for (const item of items) {
    const sizeOpt = await db
      .select()
      .from(schema.sizeOptions)
      .where(eq(schema.sizeOptions.stripePriceId, item.stripePriceId))
      .get()

    // BUG #6 fix: treat missing OR inactive sizeOption as unavailable.
    // Mirror COD's assertItemsAvailable behaviour — return 422 BEFORE
    // calling createOrder so no order/stock is ever written for a bad item.
    if (!sizeOpt || !sizeOpt.active) {
      return c.json(
        {
          error: `Item not available: ${item.stripePriceId}`,
        },
        422,
      )
    }

    orderItems.push({ sizeOptionId: sizeOpt.id, quantity: item.quantity })
  }

  // createOrder atomically reserves stock; it throws StockError if an item sold
  // out between catalogue render and checkout, or CouponError if the coupon is
  // invalid. Map both to a 422 instead of a 500.
  let orderId: string
  let taxCents: number
  let taxName: string
  let taxRate: number
  let taxInclusive: boolean
  let currency: string
  try {
    ;({ orderId, taxCents, taxName, taxRate, taxInclusive, currency } = await createOrder(db, {
      paymentMethod: 'stripe_checkout',
      items: orderItems,
      // customerName/email/phone are empty placeholders — the webhook fills
      // them in from session.customer_details after checkout.session.completed.
      customerName: '',
      couponCode,
    }))
  } catch (err) {
    if (err instanceof StockError || err instanceof CouponError) {
      return c.json({ error: err.message }, 422)
    }
    throw err
  }

  // 3. Optionally look up coupon in D1 for Stripe promotion code
  let discounts: Array<{ promotion_code: string }> | undefined

  if (couponCode) {
    const coupon = await db
      .select()
      .from(schema.coupons)
      .where(eq(schema.coupons.code, couponCode))
      .get()

    if (coupon?.stripePromotionCodeId && coupon.active) {
      discounts = [{ promotion_code: coupon.stripePromotionCodeId }]
    }
    // If coupon not found or inactive, silently ignore — Stripe will not apply a discount
  }

  // 4. Determine origin for success/cancel URLs
  //    Prefer FRONTEND_URL env var; fall back to worker origin (dev/preview).
  const origin = c.env.FRONTEND_URL || new URL(c.req.url).origin

  // 5. Create Stripe Checkout session, passing orderId in metadata so the
  //    webhook can confirm the correct order row.
  try {
    const lineItems: Array<{
      price?: string
      price_data?: { currency: string; unit_amount: number; product_data: { name: string } }
      quantity: number
    }> = items.map((item) => ({
      price: item.stripePriceId,
      quantity: item.quantity,
    }))

    if (taxCents > 0 && !taxInclusive) {
      lineItems.push({
        price_data: {
          currency: currency.toLowerCase(),
          unit_amount: taxCents,
          product_data: { name: `${taxName} (${taxRate}%)` },
        },
        quantity: 1,
      })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout`,
      metadata: { orderId },
      ...(discounts ? { discounts } : {}),
    })

    // Persist session id immediately so GET /by-session/:id works before the
    // webhook fires (and so expired sessions can be matched for cancellation).
    await db
      .update(schema.orders)
      .set({ stripeSessionId: session.id, updatedAt: new Date().toISOString() })
      .where(eq(schema.orders.id, orderId))

    return c.json({ url: session.url })
  } catch (err) {
    // BUG #2 fix: session.create threw — release the stock reserved by
    // createOrder above and mark the order cancelled so it can never be
    // confirmed later (no checkout.session.completed will ever arrive for it).
    // Gate on rowsChanged so the release runs exactly once even if this
    // handler is somehow called twice for the same orderId.
    const cancelRes = await db
      .update(schema.orders)
      .set({ status: 'cancelled', updatedAt: new Date().toISOString() })
      .where(and(eq(schema.orders.id, orderId), eq(schema.orders.status, 'pending')))

    if (rowsChanged(cancelRes) === 1) {
      await releaseOrderInventory(db, orderId)
    }

    const message = err instanceof Error ? err.message : 'Stripe error'
    console.error('[stripe/checkout] session.create failed — order cancelled', { orderId, message })
    return c.json({ error: message }, 500)
  }
})

// ─── POST /webhook ────────────────────────────────────────────────────────────

app.post('/webhook', async (c) => {
  // 1. Raw body as text (must read before any other body access)
  const rawBody = await c.req.text()

  // 2. Stripe signature header
  const sig = c.req.header('stripe-signature')
  if (!sig) {
    return c.json({ error: 'Missing stripe-signature header' }, 400)
  }

  const stripe = createStripe(c.env.STRIPE_SECRET_KEY)

  // 3. Verify signature
  let event: ReturnType<typeof stripe.webhooks.constructEvent>
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, sig, c.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook signature verification failed'
    return c.json({ error: message }, 400)
  }

  const db = createDb(c.env.DB)

  // 4. Handle events
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object
      const orderId = session.metadata?.orderId

      if (!orderId) {
        // Nothing we can do without an orderId; ack to avoid retries
        console.warn('[stripe/webhook] checkout.session.completed missing orderId', event.id)
        break
      }

      // Idempotency guard — skip if already processed
      const existing = await db
        .select()
        .from(schema.stripeEvents)
        .where(eq(schema.stripeEvents.eventId, event.id))
        .get()

      if (existing) {
        console.info('[stripe/webhook] duplicate event, skipping', event.id)
        break
      }

      // Resolve payment intent ID (may be string or object)
      const stripePaymentIntentId =
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : (session.payment_intent?.id ?? null)

      // Populate customer details from Stripe session
      const customerName = session.customer_details?.name ?? null
      const customerEmail = session.customer_details?.email ?? null

      // BUG #4 fix: only confirm an order that is still pending — add a status
      // guard to the UPDATE so a previously-cancelled order can never be
      // resurrected by a late/replayed completed event. We still record the
      // idempotency row (so Stripe stops retrying) but skip notifications.
      //
      // Use a two-step approach instead of db.batch: first do the guarded UPDATE
      // and check rowsChanged, THEN insert the idempotency row. This lets us
      // branch on whether the order was actually transitioned.
      const confirmRes = await db
        .update(schema.orders)
        .set({
          status: 'confirmed',
          stripeSessionId: session.id,
          stripePaymentIntentId,
          ...(customerName ? { customerName } : {}),
          ...(customerEmail ? { customerEmail } : {}),
          updatedAt: new Date().toISOString(),
        })
        .where(and(eq(schema.orders.id, orderId), eq(schema.orders.status, 'pending')))

      // Always record the idempotency row so Stripe stops retrying this event
      // regardless of whether the order was actually in a pending state.
      await db.insert(schema.stripeEvents).values({
        id: nanoid(),
        eventId: event.id,
        type: event.type,
      })

      if (rowsChanged(confirmRes) !== 1) {
        // Order was not pending (already cancelled, confirmed, etc.) — log and ack.
        console.warn(
          '[stripe/webhook] completed event hit non-pending order — skipping side-effects',
          {
            orderId,
            eventId: event.id,
          },
        )
        break
      }

      // Backfill coupon_uses.customerEmail with the real email from Stripe.
      // createOrder writes the coupon_uses row at session-creation time when
      // contact is unknown (Stripe orders start with empty customerEmail). Now
      // that the real email is available we update the row so the per-customer
      // limit (perCustomerLimit) correctly counts this use for future orders
      // placed by the same customer.
      if (customerEmail) {
        await db
          .update(schema.couponUses)
          .set({ customerEmail })
          .where(
            and(
              eq(schema.couponUses.orderId, orderId),
              // Only fill in if still null — prevents double-writes on replay
              // (idempotency guard above prevents replay reaching here, but belt+suspenders).
              sql`${schema.couponUses.customerEmail} IS NULL`,
            ),
          )
      }

      console.info('[stripe/webhook] order confirmed', { orderId, sessionId: session.id })

      // Fire notifications post-ack (waitUntil never blocks the webhook ack).
      // Re-read the order number from D1 — customer details may have just been
      // populated above. notifyNewOrder never throws.
      const orderIdForNotify = orderId
      c.executionCtx.waitUntil(
        (async () => {
          const notifyDb = createDb(c.env.DB)
          const confirmOrder = await notifyDb
            .select({ orderNumber: schema.orders.orderNumber })
            .from(schema.orders)
            .where(eq(schema.orders.id, orderIdForNotify))
            .get()
          if (confirmOrder) {
            await notifyNewOrder(notifyDb, c.env, orderIdForNotify, confirmOrder.orderNumber)
          }
        })(),
      )

      break
    }

    case 'checkout.session.expired': {
      const session = event.data.object
      const orderId = session.metadata?.orderId

      if (!orderId) {
        console.warn('[stripe/webhook] checkout.session.expired missing orderId', event.id)
        break
      }

      // Idempotency guard — skip if already processed
      const existingExpired = await db
        .select()
        .from(schema.stripeEvents)
        .where(eq(schema.stripeEvents.eventId, event.id))
        .get()

      if (existingExpired) {
        console.info('[stripe/webhook] duplicate event, skipping', event.id)
        break
      }

      // Only cancel if still pending — do not overwrite a completed order.
      // D1 reports meta.changes: exactly one caller wins the pending→cancelled
      // transition, so the non-idempotent inventory release runs once even if
      // Stripe redelivers the event before the idempotency row commits.
      const cancelRes = await db
        .update(schema.orders)
        .set({ status: 'cancelled', updatedAt: new Date().toISOString() })
        .where(and(eq(schema.orders.id, orderId), eq(schema.orders.status, 'pending')))

      if (rowsChanged(cancelRes) === 1) {
        // Return the stock + coupon quota reserved at checkout creation to the
        // pool — otherwise every abandoned Stripe checkout leaks inventory.
        await releaseOrderInventory(db, orderId)
      }

      await db.insert(schema.stripeEvents).values({
        id: nanoid(),
        eventId: event.id,
        type: event.type,
      })

      console.info('[stripe/webhook] pending order cancelled (session expired)', {
        orderId,
        sessionId: session.id,
      })
      break
    }

    case 'payment_intent.payment_failed': {
      const pi = event.data.object
      // Log-only by design. A failed payment attempt does NOT mean the checkout
      // is abandoned — the Checkout Session stays open for retry, so cancelling
      // here would be premature. When the session is truly abandoned Stripe
      // fires checkout.session.expired, which cancels the order AND releases the
      // reserved stock + coupon quota (see that handler above).
      console.warn('[stripe/webhook] payment_intent.payment_failed', {
        id: pi.id,
        lastError: pi.last_payment_error?.message,
      })
      break
    }

    default:
      // Unhandled event — ack to avoid retries
      console.info('[stripe/webhook] unhandled event type', event.type)
  }

  return c.json({ received: true })
})

export default app
