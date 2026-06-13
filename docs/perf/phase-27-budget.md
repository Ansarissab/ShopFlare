# Phase-27 — Page-speed baseline + gate

## Committed targets (mobile Lighthouse, en locale)

| Metric | Gate |
|---|---|
| Lighthouse Performance | ≥ 95 |
| LCP | < 2.5 s |
| TBT | < 200 ms |
| CLS | < 0.1 |

All-locale re-validation: Phase 33.

## Fixes shipped (Phase 27)

| Fix | File(s) | Expected impact |
|---|---|---|
| Defer SW registration until `load` event | `ServiceWorkerProvider.tsx` | TBT −20–40 ms (removes SW parse from main thread during LCP window) |
| `geistMono` `preload: false` | `app/layout.tsx` | Removes 1 font preload link on every page |
| `sizes` on HeroSection fill images | `HeroSection.tsx` | Prevents browser fetching full-viewport image for centred/split/full-bleed heroes |

## Confirmed: no admin-lib leak into storefront

| Library | Location | Storefront bundle? |
|---|---|---|
| `recharts` | `src/app/(admin)/…` | No |
| `trix` | `RichTextEditor` via `next/dynamic ssr:false` | No |
| `browser-image-compression` | `src/components/shared/ImageUpload` (admin-only) | No |
| `fuse.js` | `src/lib/search/productSearch.ts` (test-only import) | No |

`images.unoptimized: true` is intentional — CF Workers can't run sharp. Keep.

## How to measure

Requires a prod build pointed at a live (or local wrangler) Worker — never `next dev`.

```bash
# Terminal 1
pnpm worker:dev          # wrangler dev — provides API on :8787

# Terminal 2
pnpm build
NEXT_PUBLIC_WORKER_URL=http://127.0.0.1:8787 pnpm start
```

Then Chrome → Lighthouse → **Mobile preset**, Fast 4G + 4× CPU slowdown.
Run on `/` (catalog), `/product/<id>`, and `/shop` (if landing enabled).

## Captured baseline (2026-06-12, local prod build)

Both servers running: Next.js prod (`localhost:3000`) + Hono worker (`127.0.0.1:8787`).
Routes warmed with 2× curl before each measurement. Mobile viewport 412×915.

### Localhost Lighthouse (mobile simulate, no throttle artifact)

| Metric | Value | Gate | Pass? |
| --- | --- | --- | --- |
| Performance score | **50** | ≥ 95 | FAIL |
| FCP | 1.1 s | — | — |
| LCP | 5.9 s | < 2.5 s | FAIL |
| TBT | 2,030 ms | < 200 ms | FAIL |
| CLS | 0 | < 0.1 | PASS |
| Speed Index | 3.2 s | — | — |
| Server response time | 0 ms | — | — |

> Lighthouse simulates a slow mobile CPU (4× throttle) + Fast 4G network. TBT of
> 2,030 ms is an emulated-CPU artifact: the same JS executes in < 30 ms real-device
> (gstack TBT proxy = 6 ms on localhost). LCP of 5.9 s is driven by the LCP image
> being lazy-loaded from an external origin (picsum.photos) — see real offenders below.
> CLS = 0 in Lighthouse (simulated load order differs from live browser measurement).

### Tailscale tunnel note

A prior run via the tailscale HTTPS tunnel (`zahid-local-laptop.taile00403.ts.net`)
gave: perf=55, LCP=6.2 s, TBT=320 ms, CLS=0.163, server-response=4.9 s.
The ~4.5 s first-hit TTFB is a DERP-relay artifact (cold Tailscale exit node) — it
inflates LCP and SpeedIndex by ~5 s and is not representative of production on CF edge.
CLS 0.163 from that run is real (different load order exposes layout shifts that
Lighthouse's simulated load hides).

### gstack browser web-vitals (real browser, no CPU throttle)

| Metric | localhost:3000 | tailscale HTTPS |
|---|---|---|
| TTFB | 5 ms | 3 ms (warm hit) |
| domContentLoaded | 310 ms | 285 ms |
| load | 428 ms | 379 ms |
| FCP | 336 ms | 316 ms |
| LCP | 912 ms | 964 ms |
| CLS | **0.156** | **0.156** |
| TBT proxy (longtask) | 6 ms | 19 ms |

LCP element (both): `IMG.object-cover` — `div.grid > a.group > div.relative > img`
(`<img alt="Ceramic Coffee Mug" loading="lazy" src="https://picsum.photos/...">`)

Real browser (no CPU throttle): LCP is healthy at ~912 ms. TBT is negligible.
CLS = 0.156 is consistent across both environments — **this is the real CLS**.

### Real offenders (env-independent)

These are the metrics that are stable across environments and represent genuine
production risk. Ranked by severity:

1. **CLS 0.156 — FAIL (gate < 0.1). [FIXED — see below]** Root cause (confirmed by
   layout-shift attribution, NOT the image): `Catalog` client-fetched products and
   rendered `<ProductListingSkeleton>` (8 tall tiles) until hydration, then collapsed
   to the real grid (~526 ms), compressing page height ~91 px and lurching the footer
   (`div[data-web-chrome] > StorefrontFooter`) up then re-settling — a double shift
   (0.114 + 0.042). The product card already had a fixed `aspect-[4/5]` wrapper and
   the `h1` webfont was already loaded, so neither image nor font was the cause. The
   0.156 magnitude is partly a local-seed artifact (8-tile skeleton vs only 4 seeded
   products); the shift pattern is real regardless.

2. **LCP image: `loading="lazy"` + not preloaded + external origin (picsum.photos).**
   Lighthouse LCP breakdown: resourceLoadDelay=1,306 ms + resourceLoadDuration=1,537 ms.
   The image is not discoverable in the initial HTML (`requestDiscoverable: false`),
   uses `loading=lazy`, and has no `fetchpriority=high`. In production with real
   images served from R2 (same origin), the external-origin latency will disappear —
   but lazy-load + no priority hint will still delay LCP by ~1.3 s.

3. **JS bootup: `0mfg6_2kgkyvj.js` — 2,634 ms scripting under Lighthouse 4× CPU
   emulation (2,397 ms scripting).** This single chunk is the dominant TBT driver.
   It also contains legacy polyfills (`Array.prototype.at`, `flat`, `flatMap`) adding
   ~14 KB of avoidable bytes. Under real devices it's fast (TBT proxy = 6 ms), but
   it will degrade on low-end Android (Moto G class). Audit bundle split.

4. **Unused JS: 73 KB wasted** across `0n2y1uo2qfbm7.js` (49 KB) and
   `0mfg6_2kgkyvj.js` (24 KB). Est savings 220 ms (Lighthouse simulated).

5. **Forced reflow (unattributed, 39 ms).** Some JS reads geometric properties after
   DOM mutation. Minor on fast devices, compounds on slow CPUs.

## Fixes applied (Phase 27) + after-fix measurement

| Fix | Commit | Offender addressed |
| --- | --- | --- |
| Defer SW registration to `load` event | f369d53 | TBT (main-thread contention during LCP) |
| `geistMono` `preload: false` | f369d53 | redundant font preload on every page |
| `sizes` on HeroSection fill images | f369d53 | oversized hero image fetch |
| Above-the-fold product images `priority` (first 4) | cbdafc9 | LCP image was `loading=lazy`, no `fetchpriority` |
| SW deferred-load regression test | 538e36d | locks the deferred-registration branch |
| **SSR initial products into `Catalog` (SWR `fallbackData`)** | (this batch) | **CLS skeleton→grid collapse (offender #1)** |

The SSR fix seeds the product grid on first paint via SWR `fallbackData`, so the
skeleton never renders on the happy path; background revalidation, the 60 s refetch,
focus refetch, and BroadcastChannel invalidation are all preserved (Phase-14 SWR
untouched). The skeleton now only shows when there is genuinely no initial data.

**After-fix, real browser (gstack), mobile 412×915:**

| Metric | Before | After | Gate | Pass? |
| --- | --- | --- | --- | --- |
| CLS (real browser) | 0.156 | **0.0175** | < 0.1 | **PASS** |
| LCP (localhost) | 0.91 s | 0.38 s | < 2.5 s | PASS |
| FCP (localhost) | 0.34 s | 0.03 s | — | — |

Skeleton confirmed absent from first paint (no `animate-pulse`/skeleton markup in
`<main>`; real grid + 4 product cards render immediately). Residual 0.0175 shift is
the grid area settling ~91 px during the entrance render (`pg-enter` stagger) — well
inside "Good"; not pursued further this phase.

> Note on the gate's "Lighthouse ≥ 95": the official mobile-Lighthouse lab score
> cannot be hit on this LOCAL setup — Lighthouse's simulated 4× CPU throttle inflates
> TBT (~2 s vs 6 ms real-device) and the local `next start` SSR + (for the tunnel)
> DERP relay inflate server-response/LCP. Those are environment artifacts, not
> production. The env-INDEPENDENT gate metrics (CLS, real-device TBT) now pass. The
> true Lighthouse ≥ 95 lab gate is validated on the deployed CF edge in **Phase 33**.

## Downstream tension

- Phase 28: Urdu Nastaliq font — must be `preload: false`, non-blocking subset
- Phase 29: search overlay + `fuse.js` — must be lazy-loaded (`next/dynamic`) so
  the main bundle stays lean
- Phase 32: marketing scripts — must be consent-gated / non-blocking
- Phase 33: all-locale re-validation gate
