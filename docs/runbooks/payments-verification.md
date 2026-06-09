# Payments Verification Runbook

Repeatable checklist to verify Stripe Checkout and bank_transfer against a real
test deploy. Run **before** going live or after changing payment-related code.

**Scope:** Stripe TEST MODE only. Never use live keys. Never paste secret values
into the repo, chat, or commits.

---

## Prerequisites

- A deployed `shopflare-worker` (or local `wrangler dev`) with test secrets set
- Stripe CLI installed (`brew install stripe/stripe-cli/stripe`)
- Node.js (for `stripe trigger`)

---

## Part 1 — Stripe Checkout (TEST MODE)

### 1.1 Set test secrets

Set via `wrangler secret put` against `shopflare-worker` (values are prompts — never echoed):

```bash
wrangler secret put STRIPE_SECRET_KEY       # paste sk_test_... when prompted
wrangler secret put STRIPE_PUBLISHABLE_KEY  # paste pk_test_...
wrangler secret put STRIPE_WEBHOOK_SECRET   # paste whsec_... (see §1.2)
```

Optional (confirmation email):
```bash
wrangler secret put RESEND_API_KEY
wrangler secret put RESEND_FROM
```

### 1.2 Register webhook + get whsec

**Option A — Stripe CLI (recommended for local/staging):**
```bash
stripe login
stripe listen --forward-to https://<worker-host>/api/stripe/webhook
```
The CLI prints the `whsec_...` to use as `STRIPE_WEBHOOK_SECRET`.
Subscribe events: `checkout.session.completed`, `checkout.session.expired`,
`payment_intent.payment_failed`.

**Option B — Stripe Dashboard:**
Developers → Webhooks → Add endpoint:
- URL: `https://<worker-host>/api/stripe/webhook`
- Events: `checkout.session.completed`, `checkout.session.expired`,
  `payment_intent.payment_failed`
- Copy signing secret for `STRIPE_WEBHOOK_SECRET`.

### 1.3 Run the flow

| Step | Action | Expected order state | Expected stock/coupon |
|------|--------|----------------------|-----------------------|
| 1. Create session | Add to cart → Stripe checkout → `POST /api/stripe/checkout-session` | `pending`, `stripeSessionId` set | stock reserved, coupon counted |
| 2. Pay (happy path) | Complete with test card **`4242 4242 4242 4242`** (any future expiry, any CVC) | `confirmed`, customer name/email populated, `stripe_events` row written | stock unchanged |
| 3. Abandon | Open new session, do NOT pay — wait for session to expire (or `stripe trigger checkout.session.expired`) | `cancelled` | stock + coupon released |
| 4. Decline | Use card **`4000 0000 0000 0002`** | stays `pending` (log-only, session open for retry) | unchanged |

> Note: `stripe trigger checkout.session.completed` / `stripe trigger checkout.session.expired`
> sends synthetic events without a real `metadata.orderId`. The worker logs "missing orderId"
> and acks — this is correct. Use the **real checkout flow** to exercise the order transition.

### 1.4 Verify

After each step:

1. `GET /api/orders/track/<orderNumber>` — compare status against the table above.
2. Admin Orders list — confirm status update visible.
3. Confirmation email received (if Resend configured) — check only one email sent on event replay.
4. `stripe_events` table has exactly one row per `event.id` (idempotency check).

### 1.5 Record results

Fill in actuals (update this table in a branch/PR notes — do not commit secrets):

| Step | Expected | Actual | Pass? |
|------|----------|--------|-------|
| Session created | pending + stripeSessionId | | |
| Payment completed | confirmed + customer populated | | |
| Session expired | cancelled + inventory released | | |
| Payment declined | pending (unchanged) | | |

---

## Part 2 — Bank Transfer

### 2.1 Configure bank details (no redeploy needed)

Admin → Settings:
- `bankName`
- `bankAccountTitle`
- `bankAccountNumber`
- `bankIban` (optional)
- `bankInstructions` (optional)

### 2.2 Checklist

- [ ] Store checkout: **Bank transfer** option appears in `CheckoutMethodSelector`
      (gated on `bankAccountNumber` being set).
- [ ] Place a bank_transfer order → expect `status: pending`.
- [ ] Success page shows `BankTransferInstructions` with the account details and
      order number as payment reference.
- [ ] Confirmation email (if Resend configured) contains the bank block:
      account number + order number + instructions.
- [ ] Admin → Orders → PATCH status to `confirmed`; verify the transition.
- [ ] Stock is **not** re-decremented on confirm (decremented at order creation).
- [ ] Negative: clear `bankAccountNumber` in settings → bank option disappears
      from checkout; email block omitted.

---

## Teardown

```bash
# Stop the Stripe CLI listener
^C

# Rotate test secrets you no longer need (optional — test keys are low risk)
wrangler secret delete STRIPE_SECRET_KEY
```

Leave the test deploy running or `wrangler delete` it. Never rotate live keys
as part of this procedure.

---

## Related docs

- [Stripe setup guide](../setup/stripe-setup.md)
- [Payment flows architecture](../architecture/payment-flows.md)
- [ADR-0006: Stripe Checkout only](../adr/0006-stripe-checkout-not-raw-capture.md)
