# Stripe Setup

## 1. Create Stripe account
https://dashboard.stripe.com/register

## 2. Get your API keys
Dashboard → Developers → API Keys
- Publishable key: `pk_live_...` (safe to expose)
- Secret key: `sk_live_...` (never commit)

## 3. Add secret to CF Worker
```bash
npx wrangler secret put STRIPE_SECRET_KEY
# paste sk_live_... when prompted
```

## 4. Set up webhook
Dashboard → Developers → Webhooks → Add endpoint
- URL: `https://your-worker.workers.dev/api/stripe/webhook`
- Events: `checkout.session.completed`, `checkout.session.expired`, `payment_intent.payment_failed`
- Copy signing secret → `npx wrangler secret put STRIPE_WEBHOOK_SECRET`

## 5. Create return policy page
Stripe Checkout requires a refund policy URL.
Add your store URL + `/return-policy` in Stripe Dashboard → Settings → Checkout.

## Test mode
Use `pk_test_` and `sk_test_` keys during development.
Test card: `4242 4242 4242 4242`, any future date, any CVC.

To verify a test deploy end-to-end (Stripe test-card flow + bank transfer checklist),
see [docs/runbooks/payments-verification.md](../runbooks/payments-verification.md).
