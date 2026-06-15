# Phase 35 — DRY cleanup (deferred from the codebase audit)

Status: Proposed. Planned 2026-06-15. Standalone track (not part of the 27–33 batch). Follow-up to
the codebase-wide DRY audit run after Phase 31. The safe, behavior-preserving dedups were already
shipped (commits `457c681`, `0c2fb9a`, `ee44238`, `2284c82`, `bf587d8`, `6091e02`, `3eb966e`). This
plan covers the items that were **deliberately deferred** because they change behavior, touch many
files, or carry cache/visual risk. See [dry-conventions.md](../../architecture/dry-conventions.md).

**Goal:** close the remaining DRY debt the audit surfaced, with zero unintended behavior change and
the gates green — done in small, separately-committed, individually-revertible steps.

## Cross-cutting rules

- DRY rules per [dry-conventions.md](../../architecture/dry-conventions.md). Extend/derive, never
  copy-paste.
- **Each step is its own commit** (conventional-commit style). No `git push` (user pushes).
- Behavior-preserving unless a step explicitly notes an intended change (only Step 1 + Step 6).
- **Run gates once at the END of each step's edits**, not per file (tsgo + lint, then targeted
  tests). Sub-agents doing edits run no gates; the orchestrator runs them.
- Every behavior change or new shared component gets/keeps a regression test in the right layer.
- Hand the heavy `pnpm verify` (build + integration + smoke + e2e) to the user after each step that
  touches worker routes or SSR/markup.

## Steps

1. **Unify `slugify` (rule 7) — INTENDED behavior change.**
   `worker/routes/admin/blog.ts` has a private `slugify` (120-char cap, different normalization)
   forking the canonical `src/lib/utils/index.ts` `slugify` (80-char cap) already used by
   `worker/routes/admin/categories.ts`. Decide: either (a) adopt the canonical 80-char `slugify`
   for blog (simplest; new blog slugs cap at 80), or (b) add a `maxLength` option to the shared
   `slugify` and pass 120 for blog (preserves current blog length). Recommend (a) unless a 120-char
   blog slug is genuinely needed. **Risk:** changes generated slug length for NEW blog posts only
   (existing stored slugs untouched). Verify: blog create/edit still produces valid unique slugs;
   add/extend a unit test for `slugify` covering the cap.

2. **Route SSR fetches through `fetchFromWorker` (rule 6).**
   `src/app/sitemap.ts` (5 raw fetches), `src/app/manifest.webmanifest/route.ts`,
   `src/app/admin-manifest.webmanifest/route.ts`, and `src/app/(store)/blog/rss.xml/route.ts` each
   use raw `fetch()` + a local `NEXT_PUBLIC_WORKER_URL` read, bypassing
   `src/lib/server/fetchFromWorker.ts`. **Risk:** these endpoints have specific cache semantics
   (sitemap/manifest/rss). `fetchFromWorker<T>()` likely needs to support a no-cache / custom
   `next: { revalidate }` / cache-header option first. Approach: extend `fetchFromWorker` with an
   optional cache/revalidate param (DRY the env read in one place), then migrate the 4 files and
   import their response types from `lib/types/*` (drop the local `StoreConfig`/`BlogListResponse`
   inline copies — see Step 4). Verify: sitemap.xml, both manifests, and rss.xml render identically
   (same content + same cache headers) before/after; run the e2e specs that hit them.

3. **Stop bypassing `AdminPageHeader` + extract `AdminListSkeleton` (rule 7).**
   Three admin pages (`orders`, `notify`, dashboard `page.tsx`) render a raw `<h1>` instead of
   `AdminPageHeader`. Seven admin list pages hand-roll the same `flex flex-col gap-2` +
   `Array.from({length}).map(<Skeleton/>)` loading block. Approach: route the 3 headers through
   `AdminPageHeader` (move the orders filter Select into its `actions` slot), and create
   `src/components/admin/shared/AdminListSkeleton.tsx` (props: `rows`, optional `height`) replacing
   all 7 inline skeletons. **Risk:** markup/visual diff — could shift the admin e2e/visual
   baselines. Verify: admin e2e green; if visual baselines move intentionally, regenerate them
   (`pnpm test:visual:update`) and note it. Add a unit test for `AdminListSkeleton`.

4. **Move inline `*Props` / DTO interfaces to `lib/types/*` (rule 3).**
   ~7 component `*Props` interfaces are declared inline (`OrdersTableProps`, `ProductFormProps`,
   `CatalogProps`, `ProductGridProps`, `CategoryProductSectionProps`, `FunnelTabProps`,
   `CategoryProductsManagerProps`), plus page-level DTOs (`DashboardStats`, `AdminLandingResponse`,
   `StoreReviewsResponse`, the `StoreConfig`/`BlogListResponse` copies from Step 2). Move each to the
   right `lib/types/*` file (admin/product/landing/common) and import. **Risk:** low per file but
   wide; barrel re-exports must stay consistent. Do it in **domain batches** (admin, then store,
   then pages) so diffs stay reviewable. Verify: tsgo clean after each batch.

5. **i18n the remaining hardcoded UI strings (rule 2).**
   ~19 hardcoded strings in JSX (settings section headings, dashboard stat captions, orders/products
   empty states + "Showing N of M", order-detail labels, checkout-success messages, a stray
   "Back to tracking"). Add keys under `admin.*` / `checkout.*` / `tracking.*` in `en.ts` and
   mirror in `fr.ts` + `ur.ts` (real translations). Keep the English text identical so no visible
   change / no e2e text-assertion breakage. **Risk:** large (3 locales); fr/ur shape must match
   `en.ts` or typecheck breaks. Verify: tsgo + the i18n dictionary-parity test; e2e green.

6. **AdminSearch debounce → shared constant (rule 5) — minor timing change.**
   `src/components/admin/shared/AdminSearch.tsx` hardcodes a `200`ms debounce; `SEARCH_DEBOUNCE_MS`
   (250) already exists in `lib/constants` and is used by `SearchBar`. Import and use it.
   **Risk:** trivial — debounce shifts 200→250ms. Verify: update `AdminSearch.test.tsx`'s fake-timer
   advance to the constant; test green. (Smallest item — good warm-up.)

## Done when

- [ ] All six steps shipped as separate commits; gates green after each (tsgo, lint, unit + 95%
      coverage; `pnpm verify` for worker/SSR/markup steps).
- [ ] No unintended behavior change; the two intended changes (Step 1 slug cap, Step 6 debounce)
      are noted in their commit messages.
- [ ] No raw `fetch()` / inline `WORKER_URL` left in `src/app/**`; no inline `*Props`/DTO interfaces
      in components/pages; no hardcoded UI strings in the touched files.
- [ ] `docs/architecture/dry-conventions.md` updated if any new shared primitive/component is added
      (e.g. `AdminListSkeleton`, a `cdnUrl` helper).
