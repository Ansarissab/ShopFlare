# Stripe Checkout Integration

## How it works

1. Customer clicks "Buy Now" (single item, express) or "Pay with Card" (full cart)
2. CF Worker creates a **pending order row** in D1 before calling Stripe — `orderId` is stored in the Stripe session `metadata`
3. The Stripe session ID is immediately persisted back to the order row so the success page can look up the order before the webhook fires
4. Customer is redirected to Stripe-hosted checkout and pays
5. Stripe fires `checkout.session.completed` → webhook confirms the order, fills in customer name/email from `session.customer_details`, and records a `stripe_events` row for idempotency
6. Success page calls `GET /api/orders/by-session/:sessionId` to resolve the order number and redirect to the tracking page

We never handle raw card data. PCI compliance: SAQ A (simplest level).

## Pending order and stock

A pending order row (and its items) is written before the Stripe session, so stock is decremented immediately on checkout initiation — not on webhook receipt. This prevents overselling during the payment window.

## Supported payment methods

Stripe Checkout automatically shows available methods based on customer location:
- Visa, Mastercard, Amex
- Apple Pay, Google Pay
- Local methods (varies by country)

## Pakistan-specific

Stripe is available in Pakistan (launched Nov 2023).
International cards work. Local Pakistani bank cards depend on Stripe Pakistan support.

## Coupon codes

Coupons validated in D1 (`POST /api/coupons/validate`). If the coupon has a `stripePromotionCodeId` it is passed to the Stripe session as a pre-applied discount. The cart applies the discount client-side for display; Stripe re-validates server-side.

## Webhook reliability

Stripe retries failed webhooks up to 3 times.
The worker checks the `stripe_events` table before processing — idempotent per `event.id`.

## Webhook events

| Event | Action |
| --- | --- |
| `checkout.session.completed` | Confirms order, fills customer details from session |
| `payment_intent.payment_failed` | Logged only (no order state change) |

## Test mode

Use test API keys during development.
Test cards: https://stripe.com/docs/testing
