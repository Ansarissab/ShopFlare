# Stripe Setup

## 1. Create Stripe account
https://dashboard.stripe.com/register

## 2. Get your API keys
Dashboard → Developers → API Keys
- Publishable key: `pk_live_...` (safe to expose)
- Secret key: `sk_live_...` (never commit)

## 3. Add secrets to CF Worker

> **`STRIPE_PUBLISHABLE_KEY` must be the publishable key (`pk_test_…` / `pk_live_…`),
> never a secret key (`sk_…` / `rk_…`).** It is served to the browser via
> `/api/public-config` and Stripe.js needs a `pk_` key to initialize — a secret key
> both fails checkout AND constitutes a public secret leak. A server guard in
> `worker/lib/public-config.ts` blanks any `sk_`/`rk_` value and logs an error, so a
> misconfigured secret key is refused rather than served. Double-check the prefix before
> setting it.

```bash
npx wrangler secret put STRIPE_SECRET_KEY
# paste sk_live_... when prompted
npx wrangler secret put STRIPE_PUBLISHABLE_KEY
# paste pk_live_... (publishable key only — never sk_ or rk_)
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
