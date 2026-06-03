# Plan 7 — Advanced Product & Customer Analytics

> **Status: DONE** — Implemented + audited. Commits: `94a8b88` (implementation), `227ecff` (audit fixes).

**Maps to:** AGENTS.md Phase 5 (after Phase 4 / current `feat(admin/analytics)` dashboard).
**Implementer:** Sonnet. **Constraint:** **$0 infra** — D1 / KV / R2 free tiers only. No Analytics Engine paid usage, no new third-party service.

## Goal
Extend the existing single-page analytics dashboard into a tabbed analytics suite, and surface
per-product stats on each product edit page. Add four analytic domains:

1. **Product depth** — leaderboard (orders/units/revenue), variant + size breakdown, velocity trend, slow/never-sold movers, stock-vs-sold.
2. **Product affinity / MBA** — "frequently bought together" (orderItems self-join).
3. **Customer analytics** — new-vs-returning, repeat-purchase rate, CLV top customers, RFM-lite.
4. **Funnel / abandonment** — checkout abandonment (free, from existing `pending` orders) + optional full funnel via **$0 D1 daily-rollup counters**.

## What already exists (do NOT rebuild)
- `worker/routes/admin/analytics.ts` — single `GET /` endpoint: summary, revenueByDay, paymentMethods, topProducts (top-10 by revenue), couponStats. Mounted `worker/routes/admin/index.ts:31` behind CF Access.
- `src/app/(admin)/admin/analytics/page.tsx` — client page, Recharts (Area + Pie), `StatCard`, `AdminPageHeader`, period selector (7d/30d/90d/all).
- Types `src/lib/types/store.ts:415-457` (`AnalyticsResponse` + 5 sub-interfaces).
- i18n `src/lib/i18n/en.ts` `admin.*` analytics keys.
- `src/components/ui/tabs.tsx` (base-ui Tabs) — exists, unused. Use it.
- `sizeOptions.stock` (`worker/db/schema.ts:30`, `-1` = unlimited). `orderItems.quantity` stored.
- Cancellation reason → `orders.notes`; status enum includes `cancelled`. No refunds table.

## Reuse / DRY rules (ENFORCED — see CLAUDE.md + docs/architecture/dry-conventions.md)
- **Period helper:** extract `sinceDate()` from `analytics.ts` into `worker/lib/analytics.ts` and import everywhere. Do NOT copy it per route.
- **Types:** all new shapes go in `src/lib/types/store.ts` (Analytics* namespace). Never declare per-file.
- **Strings:** all labels in `src/lib/i18n/en.ts` `admin.*`. Zero hardcoded JSX text.
- **Constants:** metric keys, RFM thresholds, abandonment window hours, sampling rate → `src/lib/constants/index.ts`.
- **Schemas:** event/query Zod in `src/lib/schemas/` (shared client + worker). Derive, never inline.
- **Network:** `apiGet/apiPost` from `src/lib/api.ts` only. No raw fetch.
- **Charts:** if any chart layout repeats, extract a `ChartCard` wrapper into shared admin components rather than copy-pasting `ResponsiveContainer` blocks.
- **Money:** `formatPrice()` from `src/lib/utils`. Cents everywhere; never float math.

---

## Phase 5.0 — Foundation (SEQUENTIAL, do first; everything else depends on it)

**Agent A0 — scaffold tabs + shared layer.**
1. Add tabs to `analytics/page.tsx`: `Overview | Products | Customers | Funnel` (base-ui `Tabs`, `variant="line"`). Move ALL current content into the **Overview** `TabsContent` unchanged. Other tabs render new child components (one component file per tab under `src/components/admin/analytics/`).
2. Extract `sinceDate()` → `worker/lib/analytics.ts`; re-import in existing `analytics.ts`. Also export shared filter builders (`inPeriod`, `activeOnly`).
3. Add new worker sub-routes under the analytics router (keep one file per domain): `analytics/products.ts`, `analytics/customers.ts`, `analytics/funnel.ts`. Mount them on the existing analytics Hono app (e.g. `app.route('/products', products)`), so paths become `/api/admin/analytics/products` etc. All behind existing CF Access.
4. Add index migration: `CREATE INDEX` on `order_items(order_id)` and `order_items(product_id)` (Drizzle migration via existing flow). Needed for affinity + leaderboard perf and to keep D1 reads in free tier.
5. Add new i18n keys + new `Analytics*` types as you go (each later agent extends).

Tab state may use URL search param (`?tab=products`) for deep-linking; optional but preferred.

---

## Phase 5.1 — Product depth (PARALLEL after 5.0)

**Agent A1 — `analytics/products.ts` + Products tab + per-product panel.**

Endpoint `GET /api/admin/analytics/products?period=` returns:
- `leaderboard[]`: per product — `orders` (`COUNT(DISTINCT order_id)`), `unitsSold` (`SUM(quantity)`), `revenueCents` (`SUM(quantity*price_cents)`), derived `aovCents`. Active orders only. Order by chosen metric, no hard limit (or top-50). This supersedes the old `topProducts`; keep Overview's topProducts as-is or point it at this.
- `variants[]`: group by `variant_id` (join `variants` for `label`,`colorHex`) → units + revenue. Which color sells.
- `sizes[]`: group by `size_option_id` / `size` → units + revenue.
- `slowMovers[]`: products LEFT JOIN orderItems-in-period → zero or bottom-N units; include on-hand stock = `SUM(sizeOptions.stock)` (treat `-1` as unlimited → flag, don't sum). Inventory-turnover proxy = `unitsSold / max(stock,1)`.

Endpoint `GET /api/admin/analytics/products/:productId?period=` (for per-product panel):
- `unitsSold`, `orders`, `revenueCents`, `lastSoldAt` (MAX createdAt), `velocity[]` (units by day), `stockOnHand`, top affinity partners (see 5.2 — call shared helper).

Frontend:
- **Products tab** (`src/components/admin/analytics/ProductsTab.tsx`): leaderboard table sortable by orders/units/revenue (client sort), variant mini-table, size mini-table, slow-movers list. Reuse `StatCard` for headline numbers.
- **Per-product panel:** new section in `src/components/admin/products/ProductForm.tsx`, rendered only when `initial` exists (edit mode). Fetch `/api/admin/analytics/products/:id` via `apiGet`. Show stat cards + a small Recharts velocity sparkline + stock-vs-sold. Place after main fields, before variants.

---

## Phase 5.2 — Product affinity / MBA (PARALLEL after 5.0)

**Agent A2 — affinity query + UI.** Put the core query in `worker/lib/analytics.ts` (`topAffinityPairs`, `affinityForProduct`) so both the products endpoint and per-product panel reuse it (DRY).

Query: self-join `order_items a JOIN order_items b ON a.order_id=b.order_id AND a.product_id < b.product_id`, group by `(a.product_id,b.product_id)`, `pairCount = COUNT(DISTINCT a.order_id)` (support), order desc, `LIMIT` (constant, e.g. 20). Join `products` twice for names. Confidence (optional) = `pairCount / ordersContaining(a)`.

$0 guardrails: period-bounded, `LIMIT`ed, relies on the `order_items(order_id)` index from 5.0. Self-join is O(items²) per order — fine for small-business order sizes; cap by period.

Frontend: "Frequently bought together" table in Products tab (Product A + Product B, times bought together, confidence%). Also feed `affinityForProduct` into the per-product panel ("often bought with").

---

## Phase 5.3 — Customer analytics (PARALLEL after 5.0)

**Agent A3 — `analytics/customers.ts` + Customers tab.**

Key customers off `LOWER(customer_email)` with phone fallback (normalize in SQL; document the choice). Active orders only.

`GET /api/admin/analytics/customers?period=` returns:
- `summary`: `totalCustomers` (distinct), `returningCustomers` (>1 order), `repeatRatePct`, `avgClvCents`.
- `topCustomers[]`: email-keyed — `orders`, `totalSpentCents` (CLV), `firstOrderAt`, `lastOrderAt`. `LIMIT 20`.
- `rfm[]` / segment counts: recency = days since `lastOrderAt`; frequency = order count; monetary = total spent. Tertile/threshold scoring (thresholds in `lib/constants`). Return segment buckets (e.g. Champions / Loyal / At-risk / New) with counts — keep scoring simple (SQL CASE or JS post-process).

**PII note:** emails are PII; endpoint already behind CF Access (admin-only) — that's sufficient, but mask in any non-essential display (e.g. `j***@x.com`) per existing PII-handling convention. Do not log emails.

Frontend (`CustomersTab.tsx`): stat cards (total / returning% / repeat rate / avg CLV), top-customers table (masked email, orders, CLV, last order), RFM segment count cards.

---

## Phase 5.4 — Funnel / abandonment ($0, PARALLEL after 5.0 for layer 1; layer 2 is opt-in)

**Agent A4. Two layers — ship layer 1 first, layer 2 only if the merchant opts in.**

### Layer 1 — Checkout abandonment (ZERO new infra, ship always)
Orders are created in `pending` and advanced by the merchant/payment. A `pending` order older than N hours that never reached `confirmed`+ = **abandoned checkout**. Fully free, already in D1.

`GET /api/admin/analytics/funnel?period=`:
- Stage counts from `orders`: created → paid/confirmed (`status NOT IN (pending,cancelled)`) → delivered.
- `abandonedCheckouts[]`: `status='pending' AND createdAt < now-Nh` (N = constant). Include customer contact + total → recoverable list.
- `checkoutAbandonmentRatePct`.

**Document the ceiling:** this only sees sessions that reached order creation. True view→cart drop-off needs Layer 2.

### Layer 2 — Full funnel via $0 D1 daily rollups (OPTIONAL, gated by a store setting)
No Analytics Engine. No raw event firehose. **Daily-rollup counters in D1** to stay inside the 100k-writes/day free tier and keep storage bounded.

Schema (Drizzle migration):
- `analytics_daily(date TEXT, metric TEXT, count INTEGER, PRIMARY KEY(date, metric))` — upsert `count = count+1`. Metrics: `product_view`, `add_to_cart`, `checkout_start`, `purchase`. One row per metric per day → tiny, no pruning pressure.
- (Optional, for abandoned-cart recovery) `carts(session_id TEXT PRIMARY KEY, items TEXT, updated_at TEXT, recovered INTEGER DEFAULT 0)` — snapshot written **only on checkout_start**, not on every add. Prune rows older than 30d on write or via scheduled worker.

Ingest endpoint `POST /api/events` (public): body validated by a new Zod schema in `src/lib/schemas/`. Rate-limited via existing `worker/lib/ratelimit.ts` (KV). Anonymous `sessionId` = uuid in localStorage, sent via `apiPost`. **Sampling:** high-volume `product_view` may be sampled (constant `EVENT_SAMPLE_RATE`) to protect write quota; `log()`/document the sample rate so funnel numbers are interpreted correctly. Client emits events from existing cart/checkout flows (`useCart`, checkout start).

`$0 guardrails (state these in the funnel UI + docs):`
- D1 only; daily rollups not per-event rows → writes ≈ (#distinct metrics) upserts/day, trivially within free tier.
- `carts` snapshot only at checkout_start + 30d prune → bounded rows.
- Sampling on the one firehose metric (views).
- No new bindings; reuse KV rate-limit, R2 untouched.

Frontend (`FunnelTab.tsx`): funnel bar (views→carts→checkouts→purchases from `analytics_daily`; show "—" + a "tracking off" notice when Layer 2 disabled), abandonment-rate cards, recoverable abandoned-checkouts table (Layer 1), abandoned-carts list (Layer 2 if on).

---

## Phase 5.5 — Polish / audit
- All new strings in `en.ts`; grep JSX for hardcoded text.
- All new types in `lib/types/store.ts`; no per-file `*Props`.
- All thresholds/keys/windows in `lib/constants`.
- Drizzle migrations checked in; indexes present.
- No PII logged; emails masked in UI.
- Confirm every new worker query is period-bounded + index-backed (D1 free-tier safety).
- Optional: CSV export of leaderboard/top-customers (reuse any existing export util; else defer to v2).

## Suggested agent parallelism (for the implementing session)
- **Sequential:** 5.0 (foundation) → then run **5.1, 5.2, 5.3, 5.4-Layer1 in parallel** (separate files, low overlap). 5.4-Layer2 last (touches schema + client flows + ingest).
- Overlap risk: `worker/lib/analytics.ts` (shared by 5.1/5.2/5.4) and `lib/types/store.ts` / `en.ts` (touched by all). Either assign those shared files to 5.0 up front (stub the helpers + types + keys) so feature agents only fill bodies, or use worktree isolation per AGENTS.md.

## Out of scope (NOT $0 / needs infra not in stack — defer to v2)
Session replay, heatmaps, multi-touch attribution / ROAS, A/B & multivariate testing, demand forecasting, price elasticity, propensity/NBO scoring, real-time streaming dashboards. These need paid analytics infra or an event firehose that breaks the $0 mandate.
