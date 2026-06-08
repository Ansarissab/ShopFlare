# Plan 20 — Reviews optional + toggleable (site-wide AND per-product)

> **For the implementer (Sonnet):** Execute end-to-end. Follow CLAUDE.md DRY rules.
> UI strings live in [`src/lib/i18n/en.ts`](../../../src/lib/i18n/en.ts) — never hardcode
> in JSX. No new raw `fetch()` in app code (use [`src/lib/api.ts`](../../../src/lib/api.ts)).
> Zod: extend the bases in [`src/lib/schemas/`](../../../src/lib/schemas), never inline.
> Do **not** `git push` or open a PR. Small focused commits per §5.

---

## 1. Goal

Make Reviews an **optional, toggleable** capability — item #5 on the roadmap. Two
independent switches, enforced **server-side** (not merely hidden UI):

- **`reviewsEnabled`** — site-wide Feature Flag (Store Config / KV-backed config).
- **`products.reviewsEnabled`** — per-product column (default `1`/true).

**Precedence:** site-wide OFF wins over per-product. Effective-enabled =
`siteWideReviewsEnabled && product.reviewsEnabled`.

**OFF semantics:**
- Storefront hides the review display **and** the submit form for that product.
- Worker **blocks new submissions** with `403` (so a bot can't POST to a disabled
  product even though the form is gone).
- Existing review rows in D1 are **preserved** — toggling off then on shows them again.

---

## 2. Current state (verified)

Reviews are fully built today with **no toggle**. Everything below already exists:

| Concern | Location |
|---|---|
| Table `reviews` | [`worker/db/schema.ts:142-153`](../../../worker/db/schema.ts) — `{ id, orderId, productId, customerName, rating, body, photoUrl, photoR2Key, approved(default false), createdAt }` |
| `products` table | [`worker/db/schema.ts:7-15`](../../../worker/db/schema.ts) — `{ id, name, description, active, stripeProductId, createdAt, updatedAt }` (no `reviewsEnabled` yet) |
| Public submit | `POST /api/reviews` — [`worker/routes/reviews.ts:25`](../../../worker/routes/reviews.ts) (Turnstile + rate-limit + verified-purchaser + dup-prevent + insert `approved:false`) |
| Public read | `GET /api/reviews/product/:productId` — [`worker/routes/reviews.ts:127`](../../../worker/routes/reviews.ts) (approved only + aggregate `{ reviews, average, count }`) |
| Admin moderation API | [`worker/routes/admin/reviews.ts`](../../../worker/routes/admin/reviews.ts) — GET list `:18`, PATCH `/:id:50`, DELETE `/:id:83` |
| Review Zod | [`src/lib/schemas/product.ts:1-47`](../../../src/lib/schemas/product.ts) — `reviewBase`, `submitReviewSchema`, `moderateReviewSchema` |
| Storefront display/submit | [`ReviewsSection.tsx`](../../../src/components/store/product/ReviewsSection.tsx), [`ReviewForm.tsx`](../../../src/components/store/product/ReviewForm.tsx), [`ReviewStars.tsx`](../../../src/components/store/product/ReviewStars.tsx) |
| Mounted (SSR per Phase 17) | [`src/app/(store)/product/[slug]/page.tsx:82`](../../../src/app/(store)/product/[slug]/page.tsx) |
| Admin moderation UI | [`src/app/(admin)/admin/reviews/page.tsx`](../../../src/app/(admin)/admin/reviews/page.tsx) + [`AdminReviewRow.tsx`](../../../src/components/admin/reviews/AdminReviewRow.tsx) |
| Admin settings page | [`src/app/(admin)/admin/settings/page.tsx`](../../../src/app/(admin)/admin/settings/page.tsx) |
| Admin product edit page | [`src/app/(admin)/admin/products/[id]/page.tsx`](../../../src/app/(admin)/admin/products/[id]/page.tsx) |
| Product GET (feeds the page) | `GET /api/products/:id` — [`worker/routes/products.ts:52`](../../../worker/routes/products.ts), payload built by [`assembleProduct`](../../../worker/lib/products.ts) (`{ product, variants, categoryIds }`) |
| Admin product update | `PUT /api/admin/products/:id` — [`worker/routes/admin/products.ts:87`](../../../worker/routes/admin/products.ts) via `updateProductSchema` |
| Product Zod | [`src/lib/schemas/admin.ts:18-25`](../../../src/lib/schemas/admin.ts) — `createProductSchema` + `updateProductSchema = createProductSchema.partial()` |
| Storefront review types | [`src/lib/types/product.ts:120-142`](../../../src/lib/types/product.ts) — `ReviewsSectionProps`, `ReviewFormProps`, `ProductReviewsResponse` |
| CONTEXT terms | [`CONTEXT.md:84` (Review), `:94` (Feature Flag)](../../../CONTEXT.md) — **already updated** for this toggle (verify, no edit needed) |

### Depends on Phase 17 (reuse — do NOT redefine)

[`phase-17-foundations.md` §2.1](./phase-17-foundations.md) introduces the Feature-Flag
infrastructure this plan builds on:

- `FEATURE_FLAGS` in `src/lib/features.ts` with `reviewsEnabled: true` (on by default — reviews are live today).
- `isFeatureEnabled(config, key)` client helper + worker mirror `worker/lib/features.ts`.
- `reviewsEnabled` added to `storeConfigSchema` ([`src/lib/schemas/config.ts:40`](../../../src/lib/schemas/config.ts)).

**Phase 20 must NOT re-create any of these.** If Phase 17 has not landed when Phase 20
starts, land Phase 17 §2.1 first (it's a prerequisite). Phase 20 adds only the
**per-product** flag + the **enforcement wiring**.

---

## 3. Schema / DB

### 3.1 Migration — add `products.reviewsEnabled`

Add to the `products` table in [`worker/db/schema.ts`](../../../worker/db/schema.ts) (after `active`):

```ts
reviewsEnabled: integer('reviews_enabled', { mode: 'boolean' }).notNull().default(true),
```

Generate the migration (never hand-edit the SQL beyond verifying it):

```sh
pnpm db:generate            # drizzle-kit → worker/db/migrations/0006_*.sql
pnpm db:migrate:local       # apply to local D1
# prod (later, on rollout): pnpm db:migrate
```

Expected SQL: `ALTER TABLE products ADD reviews_enabled INTEGER NOT NULL DEFAULT 1;`
(boolean stored as 0/1; existing rows back-fill to `1` so all current products keep
reviews ON — no behaviour change until a merchant flips a switch).

### 3.2 Types + schemas (DRY — extend, don't inline)

- Product TS type is inferred from the Drizzle schema → `reviewsEnabled: boolean`
  flows automatically into `assembleProduct`'s `product` field and the GET payload.
- [`src/lib/schemas/admin.ts`](../../../src/lib/schemas/admin.ts): add to
  `createProductSchema` (so `updateProductSchema = createProductSchema.partial()`
  inherits it for free):

  ```ts
  reviewsEnabled: z.boolean().default(true),
  ```

- Site-wide flag schema is owned by Phase 17 (`storeConfigSchema.reviewsEnabled`) — reuse it.

---

## 4. Deliverables

### 4a. Worker — server-side enforcement (the load-bearing part)

**Shared guard helper** in `worker/lib/reviews.ts` (new — DRY, used by both routes):

```ts
// reviewsAllowed(env, db, productId): Promise<boolean>
//   site-wide OFF wins. Reads the site-wide flag via the worker features mirror
//   (worker/lib/features.ts → isFeatureEnabled(config, 'reviewsEnabled')) against the
//   assembled store config, AND the product's reviews_enabled column.
```

Wire it into [`worker/routes/reviews.ts`](../../../worker/routes/reviews.ts):

- **`POST /` ([:25](../../../worker/routes/reviews.ts))** — after Turnstile + body parse,
  call `reviewsAllowed(...)` for `parsed.data.productId`. If false → `403`
  (reuse the generic `VERIFY_FAILED`-style opaque message via a new `en` string, see §4d;
  do not leak whether it's the site flag or the product flag). Place the check
  **before** the duplicate/insert work.
- **`GET /product/:productId` ([:127](../../../worker/routes/reviews.ts))** — if
  `reviewsAllowed(...)` is false, return the empty/hidden shape `{ reviews: [], average: 0, count: 0 }`
  (200, not 403 — read path stays cacheable and the UI simply renders nothing).

**Product GET payload** — include the per-product flag so the SSR page can decide
without an extra round-trip. `reviewsEnabled` already rides along in
[`assembleProduct`](../../../worker/lib/products.ts)'s `product` object once §3.1 lands;
confirm it is **not** stripped by any select projection in
[`worker/routes/products.ts`](../../../worker/routes/products.ts) (the `:id` route uses
`select()` *, so it's included — verify after the migration).

> Site-wide flag source: the worker reads the same assembled config used by
> [`worker/routes/config.ts:82`](../../../worker/routes/config.ts). Do **not** add a new
> network call — reuse the existing config assembly + Phase 17 worker mirror.

### 4b. Storefront — hide when effective-enabled is false (computed server-side)

Effective-enabled is computed **on the server** in the SSR product page and passed down
as a prop — **no client-only flag read** that a tampered client could bypass.

- [`src/app/(store)/product/[slug]/page.tsx:82`](../../../src/app/(store)/product/[slug]/page.tsx):
  compute `const reviewsOn = isFeatureEnabled(config, 'reviewsEnabled') && item.product.reviewsEnabled`
  (config already loaded for SSR per Phase 17). Render `<ReviewsSection>` only when
  `reviewsOn`, **or** pass `reviewsOn` as a new prop and short-circuit inside.
- Add `reviewsEnabled: boolean` to `ReviewsSectionProps`
  ([`src/lib/types/product.ts:132`](../../../src/lib/types/product.ts)). When false,
  `ReviewsSection` renders nothing (returns `null`) — this also hides `ReviewForm`,
  which it mounts.
- Even if a client forces the section to render, the GET returns the empty shape and the
  POST returns 403 (§4a) — the UI hide is cosmetic; the worker is the gate.

### 4c. Admin — two toggles

- **Site-wide** in [`admin/settings/page.tsx`](../../../src/app/(admin)/admin/settings/page.tsx):
  an "Enable reviews" switch bound to `reviewsEnabled` in the store-config form. Writes
  via the existing config update path (`updateConfigSchema` →
  [`src/lib/schemas/admin.ts:124`](../../../src/lib/schemas/admin.ts) → `PATCH /api/admin/config`).
  No new endpoint.
- **Per-product** in [`admin/products/[id]/page.tsx`](../../../src/app/(admin)/admin/products/[id]/page.tsx):
  an "Enable reviews" switch bound to `reviewsEnabled`, written through the existing
  `PUT /api/admin/products/:id` ([`worker/routes/admin/products.ts:87`](../../../worker/routes/admin/products.ts))
  via `updateProductSchema` (now carries the field per §3.2). No new endpoint.

### 4d. Strings — [`src/lib/i18n/en.ts`](../../../src/lib/i18n/en.ts)

Add (no hardcoded text in JSX):

- `admin.settings`: `enableReviews: 'Enable reviews'`, `enableReviewsHint: 'Show customer reviews across the store. Turning this off hides reviews everywhere and stops new submissions; existing reviews are kept.'`
- `admin.products` (edit form): `enableReviews: 'Enable reviews for this product'`.
- Worker-facing 403 copy: a single opaque message (e.g. `reviews.disabled: 'Reviews are not available for this product'`) — keep it generic so it doesn't reveal which flag is off.

---

## 5. Rollout (small, focused, conventional commits)

1. `feat(db): add products.reviews_enabled column (+ migration 0006)` — §3.1 (schema + generated SQL + local apply).
2. `feat(schema): carry reviewsEnabled on product create/update schema` — §3.2.
3. `feat(worker): enforce reviews flags server-side (shared reviewsAllowed guard)` — §4a (guard helper + POST 403 + GET empty + payload field).
4. `feat(store): hide reviews when effective-enabled is false (server-computed prop)` — §4b.
5. `feat(admin): site-wide + per-product Enable-reviews toggles` — §4c.
6. `feat(i18n): reviews-toggle strings` — §4d (can fold into 4/5 if tiny).
7. `test(worker): reviews flag matrix integration tests` — §6.
8. `docs: note reviews toggle; git mv plan proposed→done` — §8.

Run `pnpm verify` before each commit; never commit red. Remote D1 migration
(`pnpm db:migrate`) runs at deploy time, not in a code commit.

---

## 6. Acceptance — flag matrix

Enforcement lives in the worker, so the matrix is proven by **integration tests**
(miniflare pool), not unit line-% — coverage is behavioral per
[ADR 0008](../../adr/0008-coverage-gate-unit-only.md).

| Site-wide | Product | GET `/product/:id` | POST `/` | Storefront |
|---|---|---|---|---|
| ON | ON | returns approved reviews | inserts (existing rules apply) | section visible |
| ON | **OFF** | `{ reviews:[], average:0, count:0 }` | **403** for that product | hidden for that product only |
| **OFF** | ON | empty for **all** products | **403** for **all** | hidden everywhere |
| **OFF** | OFF | empty for all | **403** for all | hidden everywhere |

Plus:
- **Preservation:** insert review with both ON → flip site-wide OFF (GET empty, POST 403)
  → flip back ON → the same review reappears (row never deleted).
- **No client bypass:** a direct POST to a disabled product (no Turnstile/UI) still 403s.
- **Default-on:** a freshly created product (no explicit flag) has `reviews_enabled = 1`.

Tests go in the worker integration suite alongside existing
[`worker/routes/reviews.ts`](../../../worker/routes/reviews.ts) coverage. Existing
green tests must stay green (back-fill default keeps current behaviour).

---

## 7. Non-goals

- **Review photos stay unwired** (`photoUrl`/`photoR2Key` columns remain, capture/display
  deferred to V2). This plan does not touch photo upload.
- **No review editing** by customer or admin (admin still only approves/unapproves/deletes
  via [`worker/routes/admin/reviews.ts`](../../../worker/routes/admin/reviews.ts)).
- No new public/admin endpoints — reuse config-update and product-update paths.
- No bulk "disable reviews on N products" action (one product at a time).

---

## 8. Docs to update

- [`CONTEXT.md`](../../../CONTEXT.md) — Review (`:84`) + Feature Flag (`:94`) terms
  **already describe** this toggle; **verify** they match the shipped behaviour, no edit
  expected.
- `docs/features/` — if a reviews feature doc exists, add a "Toggling reviews" note;
  else add a short note where the existing reviews docs live (do not create a sprawling
  new doc).
- `README.md` — add reviews to the merchant-toggleable feature list (matches the
  "No Redeploy Needed For" spirit in [`CLAUDE.md`](../../../CLAUDE.md)).
- On completion: `git mv docs/plans/proposed/phase-20-reviews-toggle.md docs/plans/done/`
  as the final commit (per plan lifecycle).

---

## 9. Self-audit checklist

- [ ] Migration generated + applied locally; `products.reviews_enabled` defaults to `1`, back-fills existing rows.
- [ ] Server-side enforcement on **both** flags with correct precedence (site-wide OFF wins): POST → 403, GET → empty.
- [ ] Single shared `reviewsAllowed` guard in `worker/lib` — no duplicated flag logic across routes.
- [ ] Effective-enabled computed **server-side** and passed as a prop; no client-only gating that a tampered client can bypass.
- [ ] All new UI text in [`en.ts`](../../../src/lib/i18n/en.ts); none hardcoded in JSX.
- [ ] Schemas **extended** (`createProductSchema` field → inherited by `.partial()`), not inlined; Phase 17 flag infra reused, not re-created.
- [ ] No new raw `fetch()` / endpoints — config + product update reuse existing routes.
- [ ] Integration tests cover the full §6 matrix incl. preservation + no-bypass + default-on.
- [ ] `pnpm verify` green (typecheck → lint → unit ≥95% → integration → build).
- [ ] Plan re-read end-to-end before marking done; `git mv` to `done/`.
