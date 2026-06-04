# Phase 5 — Hardening & Gap Closure

Comprehensive audit of the pending phase 2/3/4 branch (security + correctness + DRY +
completeness). Findings consolidated and prioritized. Severity: 🔴 critical/high · 🟡 medium · ⚪ low.
Each item lists the offending location and the fix. Cross-cutting items are noted once.

Audit baseline: `4fa2137` → working tree (commits c6948a1 → 5d53a10, ~37 files).

## Status

**Workstreams A (correctness), B (security), D (DRY), E (wizard) — DONE** (this pass).
Typecheck (src + worker) and lint clean. New helpers: `worker/lib/money.ts`,
`worker/lib/ratelimit.ts`, `worker/lib/notify.ts::notifyNewOrder`,
`releaseOrderInventory`, `src/lib/schemas/push.ts`.

Notable decisions vs the original findings:
- **A1** fixed by *restore-on-cancel* (stock + coupon quota returned in the Stripe
  `expired` handler and the public cancel route, gated on D1 `meta.changes` so a
  retry/double-cancel never double-restores) — NOT by moving the decrement to
  `completed` (reserving at checkout still prevents oversell during the window).
- **A2** `payment_intent.payment_failed` left log-only by design — a failed attempt
  doesn't mean the session is abandoned (Checkout stays open for retry); the
  `expired` event does the cancel+restore.
- **B1** `coupons/validate` hardened with a KV rate limit (not Turnstile — coupon
  apply happens in the cart before the Turnstile-gated form mounts).
- **B4** deploys now force `ENVIRONMENT=production` via the `worker:deploy` `--var`
  override (clean fix to the shared-`[vars]` problem; local `wrangler dev` stays
  development). Access + Turnstile dev-bypasses now log loudly and fail closed.
- **D5** the `getPriceRange` import stays `@/lib/utils/index` — `@/lib/utils`
  resolves to the sibling `utils.ts` (cn only). Auditor finding #11 was wrong; only
  the duplicate `SizeOption` import was removed.

**Workstream C (completeness / net-new features) — REMAINING.** This is the phase-5
double-down. See below.

---

## Workstream A — Correctness bugs (data integrity)

### A1 🔴 Stripe path leaks stock + coupon usage on abandoned checkout
**The single most important finding — confirmed by two independent auditors.**
`createOrder` runs at `POST /checkout-session` ([worker/routes/stripe.ts:68](worker/routes/stripe.ts#L68)),
which decrements `size_options.stock` ([worker/lib/orders.ts:375-387](worker/lib/orders.ts#L375-L387))
and increments coupon `usedCount` + inserts `coupon_uses` ([worker/lib/orders.ts:389-403](worker/lib/orders.ts#L389-L403))
**before payment**. The `checkout.session.expired` handler only sets `status='cancelled'`
([worker/routes/stripe.ts:244-284](worker/routes/stripe.ts#L244-L284)) — it never restores stock or usage.

Result: every abandoned Stripe checkout permanently leaks inventory and burns coupon quota;
items eventually show out-of-stock and usage-limited coupons stop working with zero real redemptions.

**Fix (pick one, consistently):**
- Preferred: move stock-decrement + coupon-usage recording out of `createOrder` for the Stripe
  path and into the `checkout.session.completed` webhook ([worker/routes/stripe.ts:190](worker/routes/stripe.ts#L190)); OR
- Restore stock + decrement `usedCount` + delete the `coupon_uses` row in the
  `expired`/`payment_failed`/cancel paths.
- COD is correct as-is (the order is real at creation) — keep its timing.

### A2 🔴 `payment_intent.payment_failed` leaves stale `pending` order
[worker/routes/stripe.ts:286-296](worker/routes/stripe.ts#L286-L296) — failed payments rely solely on
`session.expired` to cancel. A payment that fails without session expiry leaves a `pending` order
(and, given A1, leaked stock). Fold the cancel/restore logic from A1 into this handler too.

### A3 🟡 `perCustomerLimit` stored + editable but never enforced
`coupon_uses` rows are written with customer contact ([worker/lib/orders.ts:389-397](worker/lib/orders.ts#L389-L397))
and `perCustomerLimit` is persisted ([db/schema.ts:92](db/schema.ts#L92)), but nothing counts prior
uses per customer. A "one per customer" coupon is reusable unlimited times (COD).
**Fix:** in `evaluateCoupon`/`createOrder`, count existing `coupon_uses` for this coupon + contact
and reject when `>= perCustomerLimit`.

### A4 🟡 Stripe `completed` notify not guarded by committed idempotency row
[worker/routes/stripe.ts:190-207](worker/routes/stripe.ts#L190-L207) — order UPDATE happens before the
`stripe_events` insert, with no transaction. A crash between them lets a Stripe retry re-fire the
customer email + push (duplicate notifications).
**Fix:** insert the `stripe_events` row first (or use a D1 batch) so retries short-circuit before notifying.

### A5 ⚪ Min-order coupon message hardcodes `/100` — wrong for 0-decimal currencies
[worker/lib/orders.ts:174](worker/lib/orders.ts#L174) — `(minOrderCents / 100)` misformats PKR/BDT.
Cosmetic (message only). Use `CURRENCIES[...].decimals`.

---

## Workstream B — Security hardening

### B1 🔴 Public `coupons/validate` has no Turnstile / rate limit → code enumeration
[worker/routes/coupons.ts:32](worker/routes/coupons.ts#L32) — unlimited unauthenticated POSTs return
`{ valid, discountCents }` for any code. Every other public mutating route gates on Turnstile; this
one leaks discount config via brute force.
**Fix:** require `X-Turnstile-Token` + `verifyTurnstile`, or a KV per-IP rate limit; return a uniform
response that doesn't distinguish "missing" from "ineligible".

### B2 🟡 No rate limiting on any public POST route
[reviews.ts:19](worker/routes/reviews.ts#L19) · [notify.ts:13](worker/routes/notify.ts#L13) ·
[orders.ts:111](worker/routes/orders.ts#L111) · [coupons.ts:32](worker/routes/coupons.ts#L32).
Turnstile ≠ rate limiter. KV is already used (JWKS cache) — add a lightweight per-`CF-Connecting-IP`
counter on the public POST routes.

### B3 🟡 CORS reflects arbitrary origin + credentials when `FRONTEND_URL` empty
[worker/index.ts:14-21](worker/index.ts#L14-L21) — `origin || '*'` with `credentials: true`. The setup
wizard makes `FRONTEND_URL` optional, so a misconfigured deploy reflects any origin (CSRF surface
widener even though CF Access JWT still blocks unauth).
**Fix:** fail closed — if `FRONTEND_URL` unset and `ENVIRONMENT !== 'development'`, return `null`
(deny). Never pair credentialed CORS with a reflected/`*` origin.

### B4 🟡 Admin/Turnstile dev-bypass depends on `ENVIRONMENT`, not enforced by tooling
[worker/lib/access.ts:149-154](worker/lib/access.ts#L149-L154) (Access) and
[worker/lib/turnstile.ts:19-25](worker/lib/turnstile.ts#L19-L25) (Turnstile fail-open when secret unset).
Both bypass in "development". The wizard never writes `ENVIRONMENT`, so a forgotten secret + wrong
`ENVIRONMENT` silently disables admin auth / Turnstile.
**Fix:** require explicit `ALLOW_INSECURE_ADMIN=true` opt-in for local bypass; have the wizard write
`ENVIRONMENT="production"` into `wrangler.toml`; gate the Turnstile fail-open on `development` too;
log a loud warning whenever a bypass branch is taken.

### B5 🟡 Push routes hand-roll validation; `/send` accepts unvalidated `url`
[worker/routes/push.ts:29-101](worker/routes/push.ts#L29-L101) — `subscribe`/`unsubscribe`/`send`
use inline `typeof` checks (violates DRY rule 4) and `/send` fans arbitrary `title`/`body`/`url` to all
devices (open-redirect-ish click target). Behind CF Access, so admin-only.
**Fix:** add `pushSubscriptionSchema` / `pushSendSchema` to `lib/schemas/`, `safeParse` them, constrain
`url` to a same-origin/relative path. (Closes a DRY violation too.)

### B6 ⚪ Review submission leaks order existence via distinct status codes
[worker/routes/reviews.ts:44-83](worker/routes/reviews.ts#L44-L83) — 404/403/422 distinguish
order-not-found vs contact-mismatch vs not-delivered (oracle; mitigated by nanoid order numbers).
Collapse to a single generic failure.

### B7 ⚪ Setup wizard re-prints captured deploy stdout
[scripts/setup/index.mts:263-266](scripts/setup/index.mts#L263-L266) — `capture()` then
`process.stdout.write(out)` can surface deploy metadata into scrollback/CI logs (no hard secret leak;
`.env.local` holds only `NEXT_PUBLIC_*`). Prefer `runLive` for deploy + parse the URL from a separate
`wrangler deployments` query. (Pairs with A-side wizard bug C-W below.)

> **Verified OK (no action):** Stripe webhook signature verification + idempotency; CF Access JWT
> re-verification (JWKS/aud/iss/exp); Zod on all DB-write routes except push; no raw SQL interpolation;
> no stored XSS (React escaping + `escHtml` + JSON-LD `<` escaping); D1 only via worker; secrets
> gitignored, only `NEXT_PUBLIC_*` exposed; image upload MIME/size validated server-side; public forms
> Turnstile-gated (COD/review/notify).

---

## Workstream C — Completeness gaps (planned-but-not-done)

### Phase 3 — missing entirely
- **C1 ❌ CF Analytics Engine (orders/revenue events).** No binding in [wrangler.toml](wrangler.toml),
  no `writeDataPoint` anywhere. Add the `analytics_engine_datasets` binding + emit events on
  order create/confirm.
- **C2 ❌ Admin analytics view.** [src/app/(admin)/admin/analytics/page.tsx:7](src/app/(admin)/admin/analytics/page.tsx#L7)
  is a "coming in Phase 3" stub, but linked in the sidebar. Build the real view (depends on C1, or
  query orders directly).
- **C3 ❌ Light/dark mode toggle.** `next-themes` installed but never imported; no `ThemeProvider`,
  no toggle; `globals.css` `[data-theme="dark"]` block is dead (attribute never set). Wire provider in
  root layout + add a toggle.

### Phase 2/3 — partial / not wired
- **C4 🟡 Dashboard low-stock is hardcoded `0`** ([src/app/(admin)/admin/page.tsx:27](src/app/(admin)/admin/page.tsx#L27));
  revenue is a client sum of ≤100 orders, not a true aggregate. Add a backend
  `/api/admin/stats` endpoint (count, revenue, low-stock-below-threshold).
- **C5 🟡 Store settings missing logo / brand colors / policy-pages UI**
  ([src/app/(admin)/admin/settings/page.tsx](src/app/(admin)/admin/settings/page.tsx)). Backend
  `PUT /config/store` is generic key/value so no API work — add the form fields (logo→R2 upload,
  color pickers, policy rich text). These are core dynamic-config items per CLAUDE.md.
- **C6 🟡 PWA manifest not advertised + icons missing.** [public/manifest.json](public/manifest.json)
  and [public/sw.js](public/sw.js) exist and SW registers, but no layout links the manifest, and
  referenced `/icon-192.png`, `/icon-512.png`, badge/favicon assets don't exist in `public/`. Add
  `<link rel="manifest">` (or Next `metadata.manifest`) + ship the icon assets.
- **C7 🟡 `EnablePushButton` is never rendered** — merchant has no UI to opt into push
  ([src/components/admin/shared/EnablePushButton.tsx](src/components/admin/shared/EnablePushButton.tsx)).
  Mount it (e.g. in settings or dashboard header).
- **C8 🟡 Notify-Me is email-only.** WhatsApp/SMS path deliberately deferred (phone subscribers left
  `notified=false`, [worker/routes/notify.ts:6-9](worker/routes/notify.ts#L6-L9)). Either build an
  SMS/WhatsApp dispatch or document as a v1 limitation + hide phone-only subscribe.

### SEO (correctness-adjacent)
- **C9 🟡 Product page + JSON-LD are client-only → invisible to crawlers.**
  [src/app/(store)/product/[slug]/page.tsx:49](src/app/(store)/product/[slug]/page.tsx#L49) is
  `'use client'` and [ProductJsonLd.tsx:53](src/components/store/product/ProductJsonLd.tsx#L53) returns
  `null` until a client fetch settles, so the structured data never appears in server HTML — defeating
  the SEO feature. Move product fetch + JSON-LD to the server (server component / `generateMetadata`).
- **C10 ⚪ `ProductJsonLd` not passed `storeUrl`/`storeName`**
  ([src/app/(store)/product/[slug]/page.tsx:73](src/app/(store)/product/[slug]/page.tsx#L73)) — so
  `offers.url` and `brand` are dropped. Pass `storeUrl={SITE_URL}` + store name.

### Phase 4
- **C11 ⚪ Setup screenshots** — none under `docs/`. Add visuals to the setup guides (manual/deferred).

---

## Workstream D — DRY / convention cleanups

- **D1 🟡 Duplicated post-order notify block** across COD ([worker/routes/orders.ts:144-161](worker/routes/orders.ts#L144-L161))
  and Stripe ([worker/routes/stripe.ts:213-238](worker/routes/stripe.ts#L213-L238)). Extract
  `notifyNewOrder(env, orderId, orderNumber)` into the existing [worker/lib/notify.ts](worker/lib/notify.ts)
  and call from both. (DRY rule 7.)
- **D2 🟡 `submitReviewSchema` duplicates `reviewSchema` fields verbatim**
  ([src/lib/schemas/product.ts:14-23](src/lib/schemas/product.ts#L14-L23)) — extract a shared review
  base and `.extend()` both. (DRY rule 4.)
- **D3 🟡 Hardcoded UI strings** (DRY rule 2): [ReviewStars.tsx:18,27](src/components/store/product/ReviewStars.tsx#L18)
  (aria-labels), [EnablePushButton.tsx:54](src/components/admin/shared/EnablePushButton.tsx#L54) (`'…'`),
  [ReviewForm.tsx:91,106](src/components/store/product/ReviewForm.tsx#L91) (placeholders),
  [CouponForm.tsx:92](src/components/admin/coupons/CouponForm.tsx#L92) (`SAVE20`). Move to `lib/i18n/en.ts`.
- **D4 🟡 Per-file types** (DRY rule 3): [usePushSubscription.ts:20,26](src/hooks/usePushSubscription.ts#L20)
  (`PublicConfig`, `UsePushSubscriptionReturn`), inline `ReviewTable` props in
  [admin/reviews/page.tsx:11-17](src/app/(admin)/admin/reviews/page.tsx#L11-L17), `OfferBlock` in
  [ProductJsonLd.tsx:78-81](src/components/store/product/ProductJsonLd.tsx#L78-L81). Move to
  `lib/types/store.ts`.
- **D5 ⚪ Import cleanups** (DRY rule 8): [ProductJsonLd.tsx:11](src/components/store/product/ProductJsonLd.tsx#L11)
  `@/lib/utils/index` → `@/lib/utils`; duplicate `SizeOption` import at
  [ProductJsonLd.tsx:9,13](src/components/store/product/ProductJsonLd.tsx#L9).
- **D6 ⚪ `sitemap.ts` raw fetch** ([src/app/sitemap.ts:30](src/app/sitemap.ts#L30)) — bypasses
  `lib/api`. Has a real ISR (`next.revalidate`) justification; either extend `apiGet` to accept a
  cache option or sanction this as the documented exception.

---

## Workstream E — Setup wizard robustness (the just-added code)

- **E1 🟡 KV id parse is fragile.** [scripts/setup/index.mts:81-83](scripts/setup/index.mts#L81-L83)
  grabs the first 32-hex run; wrangler v4 KV output may contain other hex tokens first.
  **Fix:** scope to the `id = "…"` line: `/id\s*=\s*"([0-9a-f-]{32,})"/i`. (D1 is safer but tighten too.)
- **E2 ⚪ Secret-put has no store-verification** ([index.mts:236,250](scripts/setup/index.mts#L236)) —
  piped stdin works for non-interactive wrangler but isn't confirmed. Consider `wrangler secret list`
  check after.
- **E3** (see B7) deploy stdout re-print.

---

## Suggested execution order

1. **A1 + A2** (inventory/coupon leak) — silent data corruption, ship first.
2. **B1 + B3 + B4** (enumeration, CORS, auth bypass) — externally exploitable / fail-open.
3. **A3, A4, B2, B5** — enforcement + abuse + push validation.
4. **C9/C10** (SEO server-render) — the JSON-LD/sitemap work is otherwise wasted.
5. **C1–C3** (Analytics Engine, admin analytics, theme toggle) — net-new Phase 3 features.
6. **C4–C8, C11** — admin/settings/PWA polish.
7. **D1–D6, E1–E3** — DRY + wizard cleanups (fold opportunistically into the above where they overlap,
   e.g. D1 with A1, B5 with D-push).

## Notes
- `index.mts` (not `index.ts`) is intentional — ESM + Node native type-stripping, no new dep.
- COD order/stock/coupon timing is correct; only the Stripe pre-payment path is wrong.
- Several DRY items overlap fixes above (B5↔push schema, D1↔A-notify) — do them together.
