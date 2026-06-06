# Phase-14 — Store-load performance metrics

## Purpose

Record prod-build before/after numbers for the phase-14 caching/prefetch/SWR changes.

## Why not dev numbers

`next dev` compiles route chunks lazily on first request, so its HAR timings and
Lighthouse scores reflect the compiler, not real load. They are meaningless.
Every number below must come from a production build served locally
(`pnpm build` then `pnpm start`) or the deployed site. Never cite `next dev`.

## Method

### 1. Produce a prod build and serve it

```bash
pnpm build      # NEXT_TELEMETRY_DISABLED=1 next build --webpack
pnpm start      # next start — serve the production build
```

### 2. Point the app at a real Worker

Set `NEXT_PUBLIC_WORKER_URL` to a real Worker origin so API calls hit live
endpoints, not a stub. Either a local Worker via `pnpm worker:dev` (wrangler) or
the deployed Worker. Example:

```bash
NEXT_PUBLIC_WORKER_URL=http://127.0.0.1:8787 pnpm start   # local worker:dev
# or
NEXT_PUBLIC_WORKER_URL=https://<deployed-worker> pnpm start
```

Run the Worker in another terminal when using local:

```bash
pnpm worker:dev   # wrangler dev worker/index.ts
```

### 3. Capture

For both `/` and a `/product/<id>` route:

- Chrome DevTools → Lighthouse, **mobile preset**, run on each route.
- Chrome DevTools → Network, record a **HAR** for each route.
- Throttle: **Fast 4G** + **4x CPU slowdown**.
- Test **cold load** (hard reload, empty cache) AND **back-navigation**
  (home → product → browser Back).

### 4. Metrics to record

- LCP
- FCP
- TTFB
- Time-to-first-API-response
- Total request count
- JS transferred

### 5. Scenario checks

- (a) Home → product click is served **warm** (Pillar B intent prefetch primed
  the browser cache).
- (b) Back-nav does **not** flash the skeleton (Pillar C SWR cache serves cached
  data immediately, revalidates in background).
- (c) An edit in Admin is reflected to shoppers **within the staleness window**
  (Pillar A edit→reload correctness gate — no stale price, no deleted product).

## Results

> **All cells are TBD until captured on a live prod build. Numbers from
> `next dev` are invalid (see above).**

### Route: `/`

| Metric | Baseline (pre-phase-14) | After A (edge/browser cache) | After B (prefetch) | After C (SWR) | After edge (Cache API) |
|---|---|---|---|---|---|
| LCP | TBD | TBD | TBD | TBD | TBD |
| FCP | TBD | TBD | TBD | TBD | TBD |
| TTFB | TBD | TBD | TBD | TBD | TBD |
| Time-to-first-API-response | TBD | TBD | TBD | TBD | TBD |
| Total request count | TBD | TBD | TBD | TBD | TBD |
| JS transferred | TBD | TBD | TBD | TBD | TBD |

### Route: `/product/:id`

| Metric | Baseline (pre-phase-14) | After A (edge/browser cache) | After B (prefetch) | After C (SWR) | After edge (Cache API) |
|---|---|---|---|---|---|
| LCP | TBD | TBD | TBD | TBD | TBD |
| FCP | TBD | TBD | TBD | TBD | TBD |
| TTFB | TBD | TBD | TBD | TBD | TBD |
| Time-to-first-API-response | TBD | TBD | TBD | TBD | TBD |
| Total request count | TBD | TBD | TBD | TBD | TBD |
| JS transferred | TBD | TBD | TBD | TBD | TBD |

## Correctness checklist

- [ ] (a) Home → product click served warm from Pillar B prefetch
- [ ] (b) Back-nav does not flash the skeleton (Pillar C SWR cache)
- [ ] (c) Admin edit reflected to shoppers within the staleness window (Pillar A edit→reload)
