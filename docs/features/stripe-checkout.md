# Stripe Checkout Integration

## How it works

Customer clicks "Buy Now" → redirected to Stripe-hosted checkout page → pays → redirected back.

We never handle raw card data. PCI compliance: SAQ A (simplest level).

## Supported payment methods

Stripe Checkout automatically shows available methods based on customer location:
- Visa, Mastercard, Amex
- Apple Pay, Google Pay
- Local methods (varies by country)

## Pakistan-specific

Stripe is available in Pakistan (launched Nov 2023).
International cards work. Local Pakistani bank cards depend on Stripe Pakistan support.

## Coupon codes

Coupons synced to Stripe Promotion Codes.
Customer enters code in Stripe checkout.
Stripe validates and applies discount server-side.

## Webhook reliability

Stripe retries failed webhooks up to 3 times.
Our worker checks `stripe_events` table before processing — idempotent.

## Test mode

Use test API keys during development.
Test cards: https://stripe.com/docs/testing
