# Plan 14 — Store-page load performance (within the static-export constraint)

> **Status:** proposed (re-opened after audit). Originated from a product-page
> slowness report (a dev HAR whose initiator stack showed
> `useApiResource.useEffect → apiGet`).
> **Do not `git push` / open a PR.** Small commits at the end.

---

## Completion status (audit-tracked)

| Pillar / criterion | State |
| --- | --- |
| A — browser caching of public GETs (products, pages, categories) | ✅ done |
| A — **edge** caching via Cloudflare Cache API | ✅ done — `worker/lib/edge-cache.ts`, version-keyed (ETag in cache key → immutable entries, no purge needed) |
| A — admin GETs `no-store` | ✅ done — middleware in `worker/routes/admin/index.ts` |
| A — RFC-7234 §4.3.4 304s repeat `Cache-Control`+`ETag` | ✅ done |
| B — prefetch on hover / focus | ✅ done — `prefetch()` in `lib/api.ts`, wired in `ProductCard` |
| B — prefetch on **viewport** (IntersectionObserver) | ✅ done — `src/hooks/useViewportPrefetch.ts` |
| C — SWR in-memory cache, instant back-nav | ✅ done — `useApiResource`; `/api/orders/*` excluded |
| D — before/after metrics on a **prod build** | ⏳ **method documented, numbers not captured** — `docs/perf/phase-14-metrics.md` (needs a live prod-build + Lighthouse/HAR run; cannot be captured headlessly) |
| Acceptance — edit→reload correctness gate verified | ⏳ pending — part of the same live run (see metrics doc checklist) |

**This plan stays in `proposed/` until Pillar D (live metrics) and the
edit→reload correctness gate are actually run on a production build and the
numbers filled into `docs/perf/phase-14-metrics.md`.** Everything else is shipped
and verified (typecheck + 102 tests green).

---

## 0. Why this plan is NOT "add SSR"

The first instinct was "convert store pages from client-fetch to SSR." That is
**rejected** — it contradicts recorded decisions:

- `docs/architecture/overview.md:24` — *"The Next.js app is a pure static export.
  No server-side rendering. Dynamic data fetched client-side from CF Worker
  endpoints."*
- ADR `0001-cloudflare-full-stack.md` — static Pages CDN + separate Hono Worker,
  chosen for **$0 hosting**. No SSR adapter is installed (`@opennextjs/cloudflare`
  / `next-on-pages` — none).
- **Dynamic-First / "No Redeploy" rule** (CLAUDE.md): products live in D1 and are
  admin-edited. So pure SSG (`generateStaticParams` baking product HTML at build)
  is also rejected — it would serve stale data and force a redeploy per edit.

If real SSR/streaming is ever wanted, it is a **separate architecture change**
(new ADR 0008, an SSR adapter, and a re-examination of the $0-cost goal). Out of
scope here. This plan makes the **existing static SPA fetch faster**, not
different.

## 1. Goal

Cut perceived load time of the public store pages — home, product detail, policy
— by removing the all-the-way-to-D1, every-time fetch waterfall. Target the
public, SEO/LCP-relevant pages; leave transactional pages (checkout, track) as
client-state SPA flows.

## 2. Current state (verified)

- **No caching on public GETs.** `worker/routes/products.ts:46` and `:76` both
  send `Cache-Control: no-cache` (list + detail). `worker/routes/pages.ts:38`
  too. So browser back-nav and CDN both re-hit the Worker → D1 every time.
  (`config.ts:87` already uses `no-cache, stale-while-revalidate=60` — better.)
- **Client waterfall.** Every public page is `'use client'` and fetches after
  hydrate via `useApiResource` (home `(store)/page.tsx:29`, product
  `(store)/product/[slug]/page.tsx:51`). Blank → JS → hydrate → fetch → paint.
- **Already done (do NOT re-add):** preconnect + dns-prefetch to the Worker
  origin and Stripe/Turnstile (`src/app/layout.tsx:74-78`). Static assets are
  cached `immutable` (`worker/index.ts:53`).
- **Measurement caveat.** The report's HAR was from `next dev` (localhost:5000).
  Dev compiles chunks lazily → its timings are meaningless. All before/after
  numbers in this plan MUST come from a prod build (`pnpm build && pnpm start`)
  or the deployed site.

## 3. Pillars (in priority order)

### Pillar A — Edge + browser caching of public GETs (biggest win)

Make `GET /api/products`, `GET /api/products/:slug`, and `GET /api/pages/:slug`
cacheable at both the browser and the Cloudflare edge, with **purge on admin
write** so Dynamic-First still holds (no stale data after an edit).

- Replace `no-cache` on these public GETs with e.g.
  `public, max-age=60, s-maxage=300, stale-while-revalidate=600` (tune values).
- Edge-cache via the Worker **Cache API** (`caches.default`) or `cf: { cacheTtl,
  cacheEverything }` on the response, keyed by URL.
- **Invalidation:** on any admin mutation of products/variants/sizes/images (and
  pages), purge the matching cache keys. Options to decide while implementing:
  Cache API `caches.default.delete(key)` for known URLs, or a short TTL +
  `stale-while-revalidate` so staleness is bounded without explicit purge. The
  admin already broadcasts a client-side `BroadcastChannel` invalidation
  (`useApiResource` `refetchOnChannel`); this adds the **server-side** half.
- Keep admin GETs (`/api/admin/*`) `no-store` — never cache authenticated data.

⚠️ Correctness gate: a customer must never see a deleted/inactive product or a
stale price after the merchant saves. Bound staleness (TTL) AND/OR purge; verify
with an edit→reload test.

### Pillar B — Intent-based prefetch of product detail

From the home grid, prefetch `GET /api/products/:slug` on **hover / focus / when
the card enters the viewport** (IntersectionObserver), so by the time the
shopper clicks, the JSON is warm (browser cache from Pillar A). Add a tiny
`prefetch(path)` to `lib/api.ts` (a `fetch` that primes the HTTP cache) — do NOT
scatter raw fetches (DRY rule 6). Wire it in the product card.

### Pillar C — Client cache / persistence for instant back-nav

`useApiResource` currently resets to `{ loading: true, data: null }` on every
mount → every back-navigation flashes the skeleton and refetches. Add a small
in-memory (module-level) SWR-style cache keyed by `path`: serve cached data
immediately, revalidate in background. Optional: persist the products list to
`sessionStorage` for instant first paint on return visits. Must respect the
existing `refetchOnChannel` / `refetchOnFocus` invalidation.

### Pillar D — Measurement discipline (do first AND last)

1. `pnpm build && pnpm start`, point the app at a real Worker, capture a HAR +
   Lighthouse for `/` and `/product/:slug`. Record LCP, TTFB-to-API, request
   count. This is the baseline.
2. After each pillar, re-measure the same way. Report deltas in the PR/notes.
   Never cite dev numbers.

## 4. Explicitly out of scope

- SSR / RSC / streaming (see §0 — needs its own ADR).
- SSG / `generateStaticParams` for product data (stale-data vs Dynamic-First).
- Manual `alt-svc` headers / HTTP-3 toggling (edge/zone setting, not app code).
- Image optimization pipeline (separate plan if needed; `images.unoptimized` is
  intentional for CF).

## 5. Acceptance criteria

- Public product/page GETs are cacheable (browser + edge); admin GETs stay
  `no-store`. An edit in admin is reflected to shoppers within the chosen
  staleness window (verified by edit→reload).
- Home → product click serves warm data (Pillar B) and back-nav does not flash
  the skeleton (Pillar C).
- Before/after metrics captured on a **prod build**, deltas reported.
- `pnpm typecheck` clean. `pnpm lint`: **no NEW errors** vs the ~23 pre-existing
  `set-state-in-effect` baseline (carried from the plan-11/12 audits — do not
  drive-by-fix those, do not add new ones).
- DRY: prefetch/cache helpers live in `lib/api.ts` + the hook, not inlined.

## 6. Suggested commits

1. `perf(worker): cache public product + page GETs at edge/browser with bounded staleness`
2. `perf(worker): purge product/page cache on admin writes`
3. `feat(api): prefetch() helper + intent-prefetch product detail from grid`
4. `perf(hooks): SWR-style cache in useApiResource — instant back-nav, bg revalidate`
5. `docs(perf): record prod-build before/after metrics`

---

> Verify each route/line against the live file before editing — line refs above
> are from the audit snapshot and may drift.
