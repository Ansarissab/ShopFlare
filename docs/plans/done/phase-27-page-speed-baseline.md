# Phase 27 — Page-speed baseline + quick wins

Status: **Done** (2026-06-13). Planned 2026-06-12 (grill-with-docs). Executed FIRST in the
27–33 batch — measured baseline established before later phases add weight. See
[roadmap](../proposed/phases-27-33-roadmap.md) and measured results in
[docs/perf/phase-27-budget.md](../../perf/phase-27-budget.md).

Outcome: baseline captured (gstack browser + mobile Lighthouse over tailscale HTTPS);
env-independent offenders fixed — CLS 0.156 → 0.0175 (SSR initial products), LCP image
prioritized, SW registration deferred, redundant font preload dropped, hero `sizes` added.
All `pnpm verify` gates green. The official ≥95 mobile-Lighthouse **lab** score is not
provable on the local-only setup (CPU-throttle + tunnel + local-SSR artifacts) and is
carried to **Phase 33** (CF-edge re-validation), as this roadmap already specifies.

**Committed target:** mobile Lighthouse ≥ 95 on all Locales, LCP < 2.5s, TBT < 200ms,
CLS < 0.1. (Today ≈ 66%.) Default Locale (en) is the hard gate here; all-Locale
re-validation is Phase 33.

## Why first

Adding i18n, search, shortcuts, and the announcement bar all move the number. Measure the
baseline and bank cheap wins now, then re-gate at the end (Phase 33).

## Steps

1. **Diagnose, don't guess.** Run Lighthouse / web-perf + a bundle analysis on the
   storefront. Pin the actual LCP element, TBT sources, and render-blockers. **Confirm
   whether `recharts` / `trix` / `browser-image-compression` (admin-only libs) leak into the
   storefront chunk.** Produce a ranked offender list. The reported "slow scripts" is a
   symptom — the real cause is unmeasured.
2. **Fix the ranked top offenders only.** Likely candidates (verify before acting):
   - LCP image handling — `StorefrontHeader` logo + product images currently use
     `unoptimized` (`src/components/store/StorefrontHeader.tsx`).
   - The 4 Google fonts (Geist + Geist_Mono preloaded, Merriweather + Nunito lazy) in
     `src/app/layout.tsx`.
   - Service-worker registration timing (`ServiceWorkerProvider`).
   - Lazy-load `fuse.js` + the search overlay (built in Phase 29).
3. **Set the gate.** Record the budget in `docs/perf/` and wire a measurement step.

## Notes

- Measure + bank wins only. Do not pre-build features here.
- Tension to respect downstream: Phase 28's Urdu Nastaliq font and Phase 32's marketing
  scripts are the two things most able to break the gate — both are designed to load
  non-blocking / consent-gated so the lab score holds.

## Done when

Baseline captured, top offenders fixed, gate + measurement wired, `pnpm verify` green.
