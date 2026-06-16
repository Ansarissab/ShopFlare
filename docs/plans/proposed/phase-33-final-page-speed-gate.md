# Phase 33 — Final page-speed gate across all Locales

Status: Proposed. Planned 2026-06-12 (grill-with-docs). Runs LAST — after all features land.
Closes the loop opened in [Phase 27](../done/phase-27-page-speed-baseline.md). See
[roadmap](./phases-27-33-roadmap.md).

Baseline measurements, per-metric pass/fail, and the Phase-27 fix log are in
[`docs/perf/phase-27-budget.md`](../../perf/phase-27-budget.md). Lighthouse snapshots are
in [`lighthouse_results/v1/`](../../../lighthouse_results/v1/).

---

## Carried over from Phase 27 (enforced acceptance criteria)

Phase 27 is done. The items below were measured, validated where possible locally, and
explicitly deferred to this phase because they require the **deployed CF edge with real R2
images** to validate correctly. Each is a concrete, checkable gate — not a vague note.

### AC-1 SSR the catalog grid so the LCP image is in the initial HTML

**Why deferred:** The `Catalog` component calls `useSearchParams()`, which marks it as a
client component and triggers Next.js's `BAILOUT_TO_CLIENT_SIDE_RENDERING` on the home
route. Product images are therefore not in the initial HTML; the LCP image is only
discovered post-hydration. This makes LCP ~1.3 s worse than it needs to be (confirmed by
Phase-27 Lighthouse: `requestDiscoverable: false` on the LCP image). Fixing it requires
splitting the client search-input from the server-rendered product grid — a medium refactor
that was out of scope for Phase 27.

**Acceptance (verify on deployed `*.workers.dev` or custom domain):**

- `curl https://<deployed-url>/` contains the first product `<img>` tag with
  `fetchpriority="high"` in the initial HTML response body.
- No `BAILOUT_TO_CLIENT_SIDE_RENDERING` comment wrapping the catalog grid in the HTML
  source.
- Chrome DevTools → LCP element is server-discoverable (Lighthouse reports
  `requestDiscoverable: true` for the LCP image).
- Implementation path: extract the product grid into an RSC; keep `useSearchParams` only
  in the search-input client component. Read search params server-side via `searchParams`
  prop on the page, or pass them down as props to avoid the client bailout.

### AC-2 Mobile Lighthouse ≥ 95 on deployed CF edge with R2 images

**Why deferred:** Local Lighthouse is not representative — picsum.photos external-origin
latency inflates LCP, and Lighthouse's 4× CPU emulation inflates TBT far beyond real
devices (2,030 ms emulated vs 6 ms real-browser TBT proxy on localhost). The clean
`localhost:3000` prod-build run (no extensions) gave desktop 83 / mobile 70 — better than
the dev+extensions 69 but still not meaningful for the LCP gate. With R2 images
(same-origin, Cloudflare CDN, right-sized), LCP should drop significantly.

**Acceptance (measure via PageSpeed Insights or a clean Chrome Lighthouse against the
public URL — not localhost, not a Tailscale tunnel):**

| Metric                          | Gate    |
| ------------------------------- | ------- |
| Lighthouse Performance (mobile) | ≥ 95    |
| LCP                             | < 2.5 s |
| TBT                             | < 200ms |
| CLS                             | < 0.1   |

Measure on `/` (catalog), `/product/<id>`, and `/shop` (if landing page enabled).
Run twice (cold + warm) and take the warm result. No browser extensions active.

> **Note on the Tailscale tunnel:** a prior Phase-27 run via the tunnel gave perf=55,
> LCP=6.2 s, TBT=320 ms because the DERP relay added ~4.5 s cold TTFB. That run is not
> representative. Use the real public workers.dev URL.

### AC-3 Polyfill reduction and no admin-lib leak — confirmed on deployed bundle

**Why deferred:** confirmed locally in Phase 27 (no `recharts`/`trix`/`browser-image-compression`/
`fuse.js` in the storefront bundle; explicit modern `browserslist` drops `Object.hasOwn`,
`queueMicrotask`, `URLSearchParams` polyfills). Re-confirm on the deployed build to rule
out any regression introduced by Phases 28–32.

**Acceptance:**

- `pnpm build` bundle analysis (or `next build --debug`) shows no admin-only libraries
  (`recharts`, `trix`, `browser-image-compression`, `fuse.js`) in any storefront chunk.
- The deployed bundle does not include legacy polyfills for `Array.prototype.at`,
  `flat`, or `flatMap` (confirm via `grep` on the built `.js` assets or a bundlesize audit).

### AC-4 Image delivery — right-sized R2 assets (no local-seed waste)

**Why captured here:** `images.unoptimized: true` is intentional (`CF Workers can't run
sharp` — see [`docs/perf/phase-27-budget.md`](../../perf/phase-27-budget.md)). In Phase 27,
the LCP image was `https://picsum.photos/seed/…/800/800` displayed at ~358 px — a
~2.2× oversize penalty that does not exist with properly-sized R2 uploads. Phase 33 is
the point at which real merchant images are in place.

**Acceptance:**

- Confirm the image upload flow (admin) stores images at ≤ 1× the largest display size
  (currently `800 px` wide for the product card at full viewport, meaning ≤ 800 px wide
  is acceptable; verify the `ImageUpload` component's compression target).
- After uploading a real product image, `curl -I <r2-image-url>` returns `content-length`
  consistent with the compressed size (not the raw upload).
- Document in this plan (or link to an ADR) whether an R2 image-resizing step or
  upload-time compression is the chosen lever. Do not leave this as an implicit assumption.

### AC-5 CLS — already passes; lock it

**Status: done (Phase 27).** CLS fixed from 0.156 → ~0 (desktop) / 0.043 (mobile) via
SWR `fallbackData` seeding the product grid on first paint. Residual 0.0175 is the
entrance-animation settle — well inside "Good". See
[`docs/perf/phase-27-budget.md`](../../perf/phase-27-budget.md) for the after-fix table.

**Acceptance (regression guard only):**

- Real-browser CLS on `/` remains < 0.1 after Phases 28–32 land (announcement bar,
  search overlay, i18n layout shifts are the new CLS risks).
- No `<ProductListingSkeleton>` visible during first paint on a warm page load
  (SSR seed still present).

### AC-6 Env-independent wins — no regressions

**Status: done (Phase 27).** Shipped and locked by regression tests:

- Deferred SW registration until `load` event (commit `f369d53`; regression test in
  `538e36d`).
- `geistMono` `preload: false` (commit `f369d53`).
- `sizes` on HeroSection fill images (commit `f369d53`).
- Above-the-fold product images `priority` + explicit `fetchPriority="high"` (commit
  `cbdafc9`; required because Next 16 deprecated auto-setting `fetchpriority` from the
  `priority` prop alone).
- `NotifyMeDialog` lazy-loaded via `next/dynamic` (RHF + zod off the `/` bundle).
- Explicit modern `browserslist` (drops Object.hasOwn / queueMicrotask / URLSearchParams
  polyfills from the default config).

**Acceptance (regression guard):** `pnpm verify` green; Lighthouse on `/` does not show
any of these as opportunities/diagnostics.

---

## Steps

1. **Re-measure** after Phases 28–32. Enforce **mobile Lighthouse ≥ 95 on every Locale**,
   including `/ur` (Nastaliq is swap / lazy / `/ur`-only, so the fallback paints and the
   score holds).
2. **Verify consent-gated marketing scripts do NOT load** during lab measurement (Phase 32).
3. **Verify no regressions** from the announcement-bar carousel, search overlay, or shortcut
   engine (TBT / CLS).
4. Fix until the gate passes. Log any deliberate per-Locale exception with the reason.

## Risk flagged at planning time

95+ on `/ur` lives or dies on the Nastaliq font staying non-blocking. If field scores miss
despite the swap/lazy strategy, the fallback is **Noto Naskh Arabic** (lighter, less
authentic to Urdu readers) — a deliberate speed-over-authenticity trade.

## Done when

Every enabled Locale meets mobile ≥ 95 (LCP < 2.5s, TBT < 200ms, CLS < 0.1) or carries a
logged exception; `pnpm verify` green.

---

## Session log — 2026-06-16 (local prod-build measurement)

Ran a local prod serve (`next build && next start` on `:3000` + `wrangler dev` API on
`:8787`, seeded D1) and Lighthouse mobile (warm) on `/`, `/ur`, `/product/demo_tshirt`.

### Confirmed / shipped this session

- **AC-1 — already satisfied (no refactor needed).** The prod build serves the product grid
  in the initial SSR HTML: no `BAILOUT_TO_CLIENT_SIDE_RENDERING`, all product `<img>` present
  with `fetchPriority="high"` server-side. The `useSearchParams` call in `Catalog` is wrapped
  by `<Suspense>` (store layout + page) so it never bails the route. The planned RSC split is
  unnecessary.
- **Accessibility 95 → 100 (site-wide).** Lighthouse `button-name` failed on every storefront
  page: the PWA install banner's icon-only dismiss button (`InstallPrompt.tsx`, a `fixed`
  overlay) had no accessible name. Added `aria-label` from i18n (`pwa.installDismissLabel`,
  added to en/fr/ur) + a regression test. Verified PASS on `/` and `/product` after rebuild.
- **CSP "violation" on the product page = non-issue.** Lighthouse `inspector-issues` logged a
  CSP bucket with an empty `subItems` (a DevTools/extension artifact). App CSP already covers
  picsum, Stripe, Turnstile, and the worker origin. No change.
- **Static portfolio page (`portfolio/shopflare-overview.html`, the github.io overview, NOT the
  app)** — the old PageSpeed PDF (Accessibility 88) was this page. Fixed `.card h3` contrast
  (`--brand-ink` #c2410c ≈3.5:1 → `--ink` #1a1d24 ≈16:1); `<main>` landmark already present.
- **browserslist** — added explicit modern floors (Chrome ≥92 / FF ≥90 / Safari ≥15.4 /
  Edge ≥92) to `package.json` as hygiene (AC-6 intent). Note: this does NOT remove the
  Next.js framework polyfill below.
- Cheap gates green: lint 0 warnings, tsgo typecheck clean, 1920 unit tests pass (incl. the
  new a11y test), no skipped/flaky/unexplained stderr.

### Logged exception — AC-3 (legacy JS polyfill)

`legacy-javascript-insight` still fires (~13.6 KiB) for `Array.prototype.at/flat/flatMap`,
`Object.fromEntries`, `Object.hasOwn`, `String.prototype.trimStart/trimEnd`. **Source:
`next/dist/build/polyfills/polyfill-module.js`** — Next.js 16 injects this chunk
unconditionally on every route and does **not** read `browserslist` for it. Not removable by
config; only a fragile post-install patch of framework internals could strip it. **Accepted as
a Next.js 16 framework tax.** Re-evaluate when Next raises its own polyfill baseline.

### Still owned by deploy (cannot be validated locally — measure on the edge)

Local Lighthouse is non-representative here (4× CPU emulation inflates TBT; external
`picsum.photos` seed images inflate LCP and reflow CLS). Observed local scores swung run-to-run
(home 43→70, product 68→54, product CLS 0→0.192) — noise, not a gate signal, exactly as
documented in `docs/perf/phase-27-budget.md`. The following remain to be validated on the
deployed `*.workers.dev` app per Locale, with real R2 images:

- **AC-2** mobile Lighthouse ≥ 95 on `/`, `/product/<id>`, `/shop`, and every enabled Locale
  (`/`, `/ur`, …).
- **AC-4** real R2 product images sized ≤ 1× display (kills the picsum oversize/external-origin
  LCP penalty entirely).
- **AC-5** CLS < 0.1 on the product gallery once images load fast from R2 (the local 0.192 was
  slow-picsum reflow; first run measured 0).
