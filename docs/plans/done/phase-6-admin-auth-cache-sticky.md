# Phase 6 — Admin Auth Hardening · Cache Freshness · Sticky Save Bar

Three independent workstreams. A and B are correctness/security; C is UX.
Severity: 🔴 critical · 🟡 important · ⚪ polish.

## Status

Proposed — not started. (Note: an in-flight change already added `Cache-Control:
no-store` to `GET /api/config/store` and a `CONFIG_BROADCAST_CHANNEL` cross-tab
ping in `useStoreConfig` + admin settings — fold that into Workstream B rather
than duplicating.)

---

## Workstream A 🔴 — Admin must ALWAYS be behind auth

### Problem
- Worker `/api/admin/*` is gated by `requireAccess` (CF Access JWT re-verified in
  the worker, fail-closed in production) — good. BUT it **dev-bypasses** when
  `ENVIRONMENT=development` and the CF Access vars are unset.
- The admin **UI routes** (`/admin/*`, served by Cloudflare Pages) have **no
  app-level gate** — see [src/app/(admin)/admin/layout.tsx](src/app/(admin)/admin/layout.tsx).
  They rely entirely on a CF Access policy being configured on the Pages route.
  If that policy is missing/misconfigured, the admin dashboard HTML is publicly
  reachable (the API calls would still 401/403 in prod, but the UI should never
  render for an unauthenticated user).

Goal: admin (UI **and** API) is unreachable without a valid identity in every
non-development environment, and the dev bypass is explicit + loud.

### Approach
1. **Edge (primary):** a CF Access self-hosted application policy covering BOTH
   the Pages `/admin*` path and the worker `/api/admin*` path. Add this to the
   setup wizard so it's not optional/forgotten.
2. **App-level defense-in-depth:** add a Next `middleware.ts` matching `/admin/:path*`
   that verifies the `Cf-Access-Jwt-Assertion` header / `CF_Authorization` cookie
   using the same RS256/JWKS logic as the worker. Invalid/missing → redirect to a
   `/admin/unauthorized` page (or 403). Extract the verify logic from
   [worker/lib/access.ts](worker/lib/access.ts) into a shared, edge-safe module so
   the middleware and the worker use one implementation (DRY).
3. **Dev bypass tightening:** only bypass when `ENVIRONMENT=development` AND an
   explicit `ADMIN_DEV_BYPASS=1` is set, so it can never be implicit. Keep the
   loud `console.warn`. Production already forces `ENVIRONMENT=production`.

### Tasks
- [ ] Extract `verifyAccessJwt` + JWKS fetch into `worker/lib/access-core.ts` (no
      Hono deps) importable by both the worker and Next middleware.
- [ ] Add `middleware.ts` gating `/admin/*` via CF Access verification.
- [ ] Add `/admin/unauthorized` page.
- [ ] Gate the dev bypass behind explicit `ADMIN_DEV_BYPASS=1` (worker + middleware).
- [ ] Setup wizard: create/print the CF Access application + policy for `/admin*`
      and `/api/admin*`.
- [ ] Tests: integration test asserting `/api/admin/*` → 401 without a token when
      `ENVIRONMENT=production`; middleware unit test rejecting missing/invalid JWT.

### Acceptance
Hitting `/admin` or `/api/admin/*` without a valid CF Access identity is blocked
in every environment except an explicitly-opted-in local dev. One verify
implementation shared by worker + middleware.

---

## Workstream B 🟡 — Cache freshness (Rails-style fingerprinting)

### Problem
When a merchant edits data (products, prices, config, coupons, policy pages),
the storefront can show a stale browser/CDN-cached response instead of the new
data. We want a dead-simple "if it changed, reload it" mechanism — like Rails
asset/content fingerprinting + ETags.

### Approach (simple, no new infra)
1. **ETag per read endpoint.** For each public list/detail GET (`/api/products`,
   `/api/products/:id`, `/api/config/store`, `/api/pages/:slug`, coupons), the
   worker computes a cheap fingerprint and returns it as `ETag`:
   `fingerprint = hash(count + max(updated_at))` over the relevant rows. Honor
   `If-None-Match` → return `304 Not Modified` when unchanged (cheap), fresh body
   when changed.
2. **Cache-Control.** Dynamic API responses use `Cache-Control: no-cache` (i.e.
   *must revalidate*, not *never store*) so the browser/CDN revalidate with the
   ETag on each load and get a 304 when nothing changed — fast AND always fresh.
   R2 product images stay `immutable` (already content-addressed by nanoid key).
3. **Write-side version bump (belt + suspenders).** A single `bumpDataVersion()`
   helper called by every admin mutation (product/variant/size/config/coupon/page
   write) increments a `dataVersion` stamp (D1 `store_config` key or KV counter).
   The fingerprint can incorporate it so even non-`updated_at` changes (deletes)
   invalidate. Cheapest correct option.
4. **Client cross-tab invalidation.** Generalize the existing
   `CONFIG_BROADCAST_CHANNEL` to a `data-updated` channel keyed by resource, so an
   admin save in one tab triggers a refetch in open storefront/admin tabs.
   `useApiResource` revalidates on window focus + on channel message.

### Tasks
- [ ] `worker/lib/fingerprint.ts` — `etagFor(rows | {count,maxUpdatedAt,version})`.
- [ ] Add ETag + `If-None-Match` 304 handling to public products/config/pages GETs.
- [ ] Set `Cache-Control: no-cache` on those responses (replace the ad-hoc
      `no-store` on config with the shared approach).
- [ ] `bumpDataVersion()` helper + call it in all admin write routes.
- [ ] Client: revalidate-on-focus + cross-tab `data-updated` channel in
      `useApiResource`; fold in the existing config broadcast.
- [ ] Tests: GET returns ETag; repeat with `If-None-Match` → 304; after an admin
      write the ETag changes and the next GET returns fresh data.

### Acceptance
Edit a product/price/config/page in admin → the storefront shows the new value on
the next load/focus (one request). Unchanged loads return a cheap `304`.

---

## Workstream C ⚪ — Sticky admin save bar

### Problem
Admin save/primary buttons sit at the bottom of long forms (e.g.
[settings/page.tsx](src/app/(admin)/admin/settings/page.tsx) — Save is below all
sections). On long pages the action is off-screen. Wanted: primary actions at the
**top**, pinned under the header while scrolling.

### Approach
- A shared `AdminPageHeader` (a.k.a. sticky action bar) component:
  `sticky top-0 z-20 border-b bg-background/95 backdrop-blur`, rendering the page
  title + a right-aligned actions slot (Save / Add / etc.).
- Each admin page renders its primary buttons into the header's `actions` slot.
  Wire submission via a `form="<id>"` attribute on the Save button (button can
  submit a form it's not nested in) or a tiny page-level context — so the sticky
  Save triggers the page's existing handler.
- Surface save state: `saving`, `disabled` when pristine (optional "unsaved
  changes" indicator).

### Tasks
- [ ] `src/components/admin/shared/AdminPageHeader.tsx` (+ `AdminPageHeaderProps`
      in `lib/types/store.ts`).
- [ ] Migrate admin pages (settings, product new/edit, coupons, pages, reviews,
      POS) to put primary actions in the sticky header.
- [ ] Wire Save handlers via `form=` button association or context.
- [ ] Optional: dirty-state detection → disable Save when unchanged.

### Acceptance
On every admin page the Save / primary action is at the top and stays pinned
under the header on scroll; clicking it saves the page.

---

## Suggested order
A (security) → B (freshness) → C (UX). A and B are independent; C is isolated and
can be done in parallel by another agent.
