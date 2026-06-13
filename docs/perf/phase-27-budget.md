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

## Downstream tension

- Phase 28: Urdu Nastaliq font — must be `preload: false`, non-blocking subset
- Phase 29: search overlay + `fuse.js` — must be lazy-loaded (`next/dynamic`) so
  the main bundle stays lean
- Phase 32: marketing scripts — must be consent-gated / non-blocking
- Phase 33: all-locale re-validation gate
