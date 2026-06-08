# Plan 24 — Payments Verification (Stripe Checkout + Bank Transfer)

> **For the implementer (Sonnet):** Execute end-to-end. Follow CLAUDE.md DRY rules.
> This is a **verification + test-gap** phase, **not** a rewrite. Both payment paths
> are already wired in code (§2). Do **not** touch build/output folders, do **not**
> `git push` or open a PR. **NEVER read `.env` / `.dev.vars` / secrets** — refer to
> secret NAMES only. Small focused commits per §5. UI strings live in
> `lib/i18n/en.ts`; never hardcode. The coverage gate is unit-only (95%); worker
> routes are covered **behaviorally** by the integration suite
> (`docs/adr/0008-coverage-gate-unit-only.md`).

This phase is item #11 on the backlog: *"get Stripe + bank transfer running, not sure
if E2E."* The verified answer is: **both already run in code.** This phase **proves it**
and **closes the one real test gap** — the Stripe webhook event-processing path.

---

## 1. Goal

Prove the two live payment methods work end-to-end, and lock that proof in:

1. **Stripe webhook integration test** — the missing one. Today only the *signature
   reject* path is tested (`worker/test/api.integration.test.ts:198-209`). The actual
   `checkout.session.completed` / `checkout.session.expired` **processing** is untested.
   Add tests that POST a **validly signed** event and assert the DB side effects.
2. **bank_transfer integration coverage** — extend if gaps (merchant confirm transition,
   email bank-block built).
3. **Manual TEST-MODE runbook** — a repeatable doc to run a real Stripe test-card
   checkout against a test deploy, and a bank_transfer manual checklist.
4. **Verification runbook** committed under `docs/runbooks/`.

No code rewrite is expected. **If verification surfaces a bug, fix it and add a permanent
regression test** in the right layer (per Phase 16 discipline,
`docs/plans/done/phase-16-comprehensive-testing.md:166-171`).

---

## 2. Current state — wired vs untested

**Both payment paths already work in code.** Verified references:

### 2.1 Stripe Checkout (wired ✅)
- `worker/routes/stripe.ts:26` — `POST /api/stripe/checkout-session`:
  rate-limit + Turnstile gate (`:32-40`); creates a **PENDING** order first via
  `createOrder` (`:93`) so the webhook has a row to confirm; line items from
  `stripePriceId` (`:131-144`); `success_url`/`cancel_url` + `metadata.orderId`
  (`:147-154`); persists `stripeSessionId` (`:158-161`).
- `worker/routes/stripe.ts:172` — `POST /api/stripe/webhook`:
  signature verify via `constructEventAsync` (`:184-195`);
  - `checkout.session.completed` (`:201-276`): idempotency via `stripe_events`,
    populate customer from `session.customer_details`, batch UPDATE order
    `status='confirmed'`, then `notifyNewOrder` via `waitUntil`.
  - `checkout.session.expired` (`:279-327`): cancel **only if still pending**, then
    `releaseOrderInventory` (`:317`) — guarded by D1 `meta.changes === 1`.
  - `payment_intent.payment_failed` (`:330-341`): **log-only by design**.
- `worker/lib/stripe.ts:7` — `createStripe(secretKey)` factory (apiVersion pinned).

### 2.2 Bank transfer (wired ✅)
- `worker/routes/orders.ts:181` — `POST /api/orders/bank-transfer` (shared handler with
  COD `:125-181`); status `pending`; `notifyNewOrder`.
- Bank details from `store_config` (`bankName`/`bankAccountTitle`/`bankAccountNumber`/
  `bankIban`/`bankInstructions`); email bank-block `worker/lib/email.ts:77`
  `buildBankBlock` (only when `paymentMethod==bank_transfer` && `bankAccountNumber` set).
- Merchant confirms via `PATCH /api/admin/orders/:id/status`
  (`worker/routes/admin/orders.ts:110`).
- UI gating `src/components/store/checkout/CheckoutMethodSelector.tsx:36` (bank shown
  only if `bankAccountNumber`). Success page
  `src/app/(store)/checkout/success/page.tsx` shows `BankTransferInstructions`.

### 2.3 Shared order assembly
- `worker/lib/orders.ts:251-498` — `createOrder` (used by COD, bank_transfer, POS,
  Stripe); `generateOrderNumber:179-181`; atomic stock decrement `:449-479`; coupon
  usage `:482-495`; `releaseOrderInventory` reverses both.

### 2.4 The test gap (what THIS phase fixes)
- `worker/test/api.integration.test.ts`: COD covered (`:88-127`), bank_transfer covered
  for config exposure + pending status (`:129-155`), Stripe webhook covered **only** for
  signature reject (`:198-209`). **The full `checkout.session.completed` / `expired`
  event PROCESSING is UNTESTED.**
- E2E `e2e/store/cart-checkout.spec.ts` covers the **COD** path (per Phase 16; Stripe
  hosted UI is intentionally not driven — see §7).

**Net:** the only missing automated proof is the webhook event-processing path. The
manual runbook covers the parts a unit/integration suite can't (real Stripe hosted
checkout, real card, real `whsec`).

---

## 3. Deliverables

### 3.1 (a) Stripe webhook integration test — the core deliverable

Add to the integration suite (workers pool / miniflare). The integration env **already
injects test secrets** — `STRIPE_WEBHOOK_SECRET: 'whsec_dummy'` and
`STRIPE_SECRET_KEY: 'sk_test_dummy'` (`vitest.integration.config.ts:46-52`) — so a test
can build a **validly signed** payload against `whsec_dummy` and the route's
`constructEventAsync` will accept it.

**File:** extend `worker/test/api.integration.test.ts` (the `describe('stripe webhook')`
block), or a focused new sibling `worker/test/stripe.integration.test.ts` (same pool,
same `apply-migrations` setup, same `beforeEach` table-clear). Prefer extending the
existing block to keep the helpers DRY; split only if the file grows unwieldy.

**Signing the event (no network, no Stripe CLI in CI):**
Construct the payload JSON, then build the `stripe-signature` header with the Stripe
SDK's test helper:
```ts
import Stripe from 'stripe'
const stripe = new Stripe('sk_test_dummy', { apiVersion: '2026-05-27.dahlia' })
const payload = JSON.stringify(event)               // event built by hand (see below)
const header = stripe.webhooks.generateTestHeaderString({
  payload, secret: 'whsec_dummy',                   // MUST match the injected env secret
})
const res = await SELF.fetch(`${BASE}/api/stripe/webhook`, {
  method: 'POST', headers: { 'stripe-signature': header }, body: payload,
})
```
The route reads the **raw** body (`worker/routes/stripe.ts:174`), so send the exact
`payload` string as the body — do not re-serialize.

**Test cases (assert the DB, not the response shape — the route always acks 200):**

1. **`checkout.session.completed` → order confirmed.**
   - Arrange: `seedProduct`, create a pending Stripe order (call `POST
     /api/stripe/checkout-session` so `createOrder` runs and reserves stock; capture the
     `orderId` from the DB by `stripeSessionId`, OR insert a pending `stripe_checkout`
     order directly via Drizzle and use its id in `metadata.orderId`). Prefer driving the
     real `checkout-session` route is not possible without a Stripe API stub, so **insert
     the pending order directly** with `createOrder`-equivalent state, mirroring how the
     route leaves it. Keep the seed DRY with `seedProduct`.
   - Build event `{ id, type: 'checkout.session.completed', data: { object: { id:
     'cs_test_x', metadata: { orderId }, payment_intent: 'pi_test_x', customer_details:
     { name: 'Jane Doe', email: 'jane@example.com' } } } }`.
   - Assert: order row `status === 'confirmed'`; `customerName`/`customerEmail` populated
     from the session; a `stripe_events` row exists for `event.id`; **stock unchanged**
     (completion does not re-decrement — it was reserved at session create);
     `stripePaymentIntentId` persisted.

2. **`checkout.session.completed` idempotent replay.**
   - POST the **same `event.id`** twice. Assert: still exactly one `stripe_events` row,
     order stays `confirmed`, no double side effect. (Guard at
     `worker/routes/stripe.ts:212-221`.)

3. **`checkout.session.expired` → pending order cancelled + inventory released.**
   - Arrange a **pending** Stripe order with reserved stock (and, in a variant, an applied
     coupon so `coupon_uses` has a row).
   - POST a signed `checkout.session.expired` with `metadata.orderId`.
   - Assert: order `status === 'cancelled'`; **stock restored** to the pre-reservation
     value (via `releaseOrderInventory`, `worker/routes/stripe.ts:317`); **coupon usage
     reverted** (`coupon_uses` row gone / `usedCount` decremented); `stripe_events` row
     written.

4. **`checkout.session.expired` does NOT cancel an already-confirmed order.**
   - Arrange a confirmed order; POST expired. Assert: status stays `confirmed`, stock
     unchanged (the `status='pending'` guard at `worker/routes/stripe.ts:307-312` wins).

5. **`checkout.session.expired` idempotent replay** — same id twice releases inventory
   **once** (assert stock not double-credited).

> Notify side effects fire via `waitUntil` and call out to Resend; assert **DB state**,
> not email delivery. `notifyNewOrder` never throws and is out of the integration scope
> (Resend isn't reachable in miniflare). No new mocks beyond what the suite already has.

### 3.2 (b) bank_transfer integration coverage — extend if gaps

Current coverage proves config exposure + pending creation
(`api.integration.test.ts:129-155`). Add the **missing transition + email** assertions:

1. **Merchant confirm:** place a `bank_transfer` order (pending), then
   `PATCH /api/admin/orders/:id/status` to `confirmed`
   (`worker/routes/admin/orders.ts:110`); assert the order row flips `pending →
   confirmed` and stock stays decremented (no re-decrement, no release).
2. **Email bank-block built (unit-level, pure):** `buildBankBlock`
   (`worker/lib/email.ts:77`) is a pure HTML builder — if not already unit-tested, add a
   **unit** test (counts toward the 95% gate): given a `store_config` map with
   `bankAccountNumber` set, the block renders the account number + order number as the
   payment reference; given **no** `bankAccountNumber`, the order email omits the block
   (gating per `worker/lib/email.ts`). Keep strings sourced from `en.bankTransfer`.

> If both transitions already pass with existing helpers, note "no gap" in the commit and
> skip — don't add redundant tests.

### 3.3 (c) Manual TEST-MODE runbook — `docs/runbooks/payments-verification.md`

New doc. A human (or the implementer on a throwaway test deploy) runs this once and
records results. Contents:

- **Scope + safety:** Stripe **TEST MODE only**. Never use live keys. Never paste secrets
  into the repo, chat, or commits.
- **Secrets (NAMES only — set, never read):** for a test deploy of `shopflare-worker`,
  set via `wrangler secret put` against the worker (config `wrangler.toml`):
  - `STRIPE_SECRET_KEY` — Stripe **test** secret (`sk_test_…`)
  - `STRIPE_WEBHOOK_SECRET` — the `whsec_…` from the webhook endpoint / `stripe listen`
  - `STRIPE_PUBLISHABLE_KEY` — Stripe **test** publishable (`pk_test_…`), surfaced by
    `/api/public-config` (`api.integration.test.ts:61-68`)
  - `RESEND_API_KEY`, `RESEND_FROM` — for confirmation email (optional for the flow;
    note that without them notify is a no-op).
  Commands (illustrative — do not echo secret values):
  ```
  wrangler secret put STRIPE_SECRET_KEY      # paste sk_test_… when prompted
  wrangler secret put STRIPE_WEBHOOK_SECRET  # paste whsec_…
  wrangler secret put STRIPE_PUBLISHABLE_KEY # paste pk_test_…
  ```
- **Webhook registration + capturing `whsec`:** two options:
  1. **Stripe CLI (recommended for local):** `stripe login`, then
     `stripe listen --forward-to https://<worker-host>/api/stripe/webhook` — the CLI
     prints the `whsec_…` to use for `STRIPE_WEBHOOK_SECRET`.
  2. **Dashboard:** add endpoint `https://<worker-host>/api/stripe/webhook`, subscribe to
     `checkout.session.completed`, `checkout.session.expired`,
     `payment_intent.payment_failed`; copy the signing secret.
- **Trigger options:**
  - Real flow: open the store, add to cart, choose Stripe, complete Stripe hosted
    checkout with test card **`4242 4242 4242 4242`** (any future expiry, any CVC, any
    ZIP). Decline card **`4000 0000 0000 0002`** for the failure path.
  - Synthetic: `stripe trigger checkout.session.completed` /
    `stripe trigger checkout.session.expired` (note: synthetic events carry no real
    `metadata.orderId`, so the route logs "missing orderId" and acks — use the **real
    flow** to verify the order transition).
- **Expected order states (record actual vs expected):**

  | Step | Trigger | Expected order | Expected stock/coupon |
  |------|---------|----------------|------------------------|
  | Create session | `POST /api/stripe/checkout-session` | `pending`, `stripeSessionId` set | stock reserved, coupon counted |
  | Pay (4242) | `checkout.session.completed` | `confirmed`, customer populated, `stripe_events` row | unchanged |
  | Abandon | `checkout.session.expired` | `cancelled` | stock + coupon released |
  | Decline (0002) | `payment_intent.payment_failed` | stays `pending` (log-only) | unchanged |

- **Verify:** track the order via `GET /api/orders/track/:orderNumber`; check admin
  orders list; confirm confirmation email received (if Resend configured); confirm only
  one email on event replay.
- **Teardown:** stop `stripe listen`; the test deploy can be left or `wrangler delete`d.
  Rotate any test secret you no longer need.

### 3.4 (d) bank_transfer manual checklist (in the same runbook)

1. Admin → Settings: set `bankName`, `bankAccountTitle`, `bankAccountNumber`, `bankIban`,
   `bankInstructions` (Dynamic-First — no redeploy).
2. Store checkout: confirm the **Bank transfer** option now appears
   (`CheckoutMethodSelector.tsx:36` gates on `bankAccountNumber`).
3. Place a bank_transfer order → expect `pending`; success page shows
   `BankTransferInstructions`; confirmation email contains the bank block with the order
   number as payment reference (`worker/lib/email.ts:77`).
4. Admin → Orders → set status `confirmed` (`PATCH …/orders/:id/status`); verify the
   transition and that stock is not re-decremented.
5. Negative: clear `bankAccountNumber` → bank option disappears from checkout and the
   email block is omitted.

---

## 4. Schema / DB

**None.** No migrations, no schema changes. `stripe_events`, `orders`, `coupon_uses`,
`size_options` already exist (`db/schema.ts`, exercised by the suite's `TABLES` clear
list `api.integration.test.ts:45-49`). This phase only reads/writes existing tables.

---

## 5. Rollout (small commits, test-first)

1. `test(stripe): signed checkout.session.completed → order confirmed + idempotent replay`
2. `test(stripe): signed checkout.session.expired → cancel + release inventory/coupon (+ guard cases)`
3. `test(orders): bank_transfer pending→confirmed via admin status PATCH` *(skip if no gap; note in msg)*
4. `test(email): buildBankBlock renders/omits bank block (unit gate)` *(skip if already covered)*
5. `docs(runbooks): payments verification runbook (Stripe test-mode + bank_transfer)`
6. `docs(payments): cross-link runbook from stripe-setup + verify payment-flows accuracy`
7. `docs: mark phase-24 done (git mv proposed/ → done/)`

If a bug is found during §3 verification: insert a `fix(...)` commit **plus** its
regression test **before** the docs commits, referencing the symptom in the test title.

---

## 6. Acceptance

- New Stripe webhook integration tests are **green in CI** and assert: confirmed
  transition + customer populated + `stripe_events` idempotency row + inventory unchanged
  (completed); pending→cancelled + inventory released + coupon reverted (expired);
  idempotent replay = single effect; expired does not clobber a confirmed order.
- bank_transfer transition + email-block coverage green (or documented as already
  covered).
- **`pnpm verify`** (`scripts/ci.mjs`: typecheck → lint → unit+coverage → integration →
  build) is **green**; unit coverage stays ≥95%.
- The manual runbook is **written and executed** at least once against a Stripe test-mode
  deploy, with the expected-states table filled in (results recorded in the runbook or
  the PR/commit notes).
- Any bug surfaced during verification has a permanent regression test.
- `git status` shows no stray build/output files; **no secret values** in any diff.

---

## 7. Non-goals

- **No new payment methods.** Stripe Checkout + bank_transfer + COD only.
- **No Stripe Connect / marketplaces / subscriptions.**
- **No raw card capture** — Stripe **Checkout** only, per
  `docs/adr/0006-stripe-checkout-not-raw-capture.md`.
- **No driving Stripe's hosted checkout UI in Playwright** — that lives behind
  `checkout.stripe.com` and is covered by the manual runbook, not E2E (consistent with
  Phase 16, `docs/plans/done/phase-16-comprehensive-testing.md:68`,`:237`).
- **No webhook-secret rotation tooling**, no production Stripe go-live (that's deployment,
  see `docs/setup/stripe-setup.md`).

---

## 8. Docs to update

- **New:** `docs/runbooks/payments-verification.md` (§3.3 + §3.4). Create the
  `docs/runbooks/` dir.
- `docs/setup/stripe-setup.md` — add a cross-link to the new runbook ("To verify a test
  deploy end-to-end, see …").
- `docs/architecture/payment-flows.md` — re-read and **verify accuracy** against
  `worker/routes/stripe.ts` as it stands today; fix any drift (e.g. the expired-release
  + idempotency behavior). No rewrite unless inaccurate.
- `README` — one line under testing/payments pointing at the runbook.
- Final commit: `git mv docs/plans/proposed/phase-24-payments-verification.md
  docs/plans/done/` once 100% done + audited (per plan lifecycle).

---

## 9. Self-audit checklist (tick before marking done)

- [ ] Signed-webhook test for `checkout.session.completed` (confirmed + customer +
      `stripe_events` row + stock unchanged).
- [ ] Signed-webhook test for `checkout.session.expired` (pending→cancelled + inventory
      released + coupon reverted).
- [ ] Idempotent **replay** test (same `event.id` twice → single effect) for both
      completed and expired.
- [ ] Guard test: expired does **not** cancel an already-`confirmed` order.
- [ ] Inventory + coupon assertions present (not just status checks).
- [ ] bank_transfer path verified: pending→confirmed via admin PATCH; email bank-block
      built/omitted.
- [ ] Runbook written **and** executed once; expected-states table filled in.
- [ ] **No secrets read or committed** — secret NAMES only; `wrangler secret put` used,
      values never echoed; no `.env`/`.dev.vars` ever opened.
- [ ] No build/output folders edited; `git status` clean of stray files.
- [ ] `pnpm verify` green; unit coverage ≥95%.
- [ ] `payment-flows.md` re-verified against `worker/routes/stripe.ts`.
- [ ] Plan re-read; any bug found got a regression test.
- [ ] Plan `git mv`'d to `docs/plans/done/`.
