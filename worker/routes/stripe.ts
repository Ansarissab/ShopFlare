import { Hono } from 'hono'
import { z } from 'zod/v4'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { nanoid } from 'nanoid'
import { createStripe } from '../lib/stripe'
import * as schema from '../db/schema'

type Bindings = {
  DB: D1Database
  KV: KVNamespace
  R2: R2Bucket
  STRIPE_SECRET_KEY: string
  STRIPE_WEBHOOK_SECRET: string
}

const app = new Hono<{ Bindings: Bindings }>()

// ─── Validation schema ────────────────────────────────────────────────────────

const checkoutItemSchema = z.object({
  stripePriceId: z.string().min(1),
  quantity: z.int().min(1).max(100),
})

const checkoutBodySchema = z.object({
  items: z.array(checkoutItemSchema).min(1).max(50),
  orderId: z.string().min(1).max(64),
  couponCode: z.string().min(1).max(64).optional(),
})

// ─── POST /checkout-session ───────────────────────────────────────────────────

app.post('/checkout-session', async (c) => {
  // 1. Parse + validate body
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const parsed = checkoutBodySchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation error', issues: parsed.error.issues }, 400)
  }

  const { items, orderId, couponCode } = parsed.data

  const stripe = createStripe(c.env.STRIPE_SECRET_KEY)
  const db = drizzle(c.env.DB, { schema })

  // 2. Optionally look up coupon in D1
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

  // 3. Determine origin for success/cancel URLs
  const origin = new URL(c.req.url).origin

  // 4. Create Stripe Checkout session
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: items.map((item) => ({
        price: item.stripePriceId,
        quantity: item.quantity,
      })),
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout`,
      metadata: { orderId },
      ...(discounts ? { discounts } : {}),
    })

    return c.json({ url: session.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Stripe error'
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
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      sig,
      c.env.STRIPE_WEBHOOK_SECRET,
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook signature verification failed'
    return c.json({ error: message }, 400)
  }

  const db = drizzle(c.env.DB, { schema })

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

      // Update order
      await db
        .update(schema.orders)
        .set({
          status: 'confirmed',
          stripeSessionId: session.id,
          stripePaymentIntentId,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.orders.id, orderId))

      // Record event for idempotency
      await db.insert(schema.stripeEvents).values({
        id: nanoid(),
        eventId: event.id,
        type: event.type,
      })

      console.info('[stripe/webhook] order confirmed', { orderId, sessionId: session.id })
      break
    }

    case 'payment_intent.payment_failed': {
      const pi = event.data.object
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
