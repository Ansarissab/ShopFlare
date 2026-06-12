# Phase 33 — Final page-speed gate across all Locales

Status: Proposed. Planned 2026-06-12 (grill-with-docs). Runs LAST — after all features land.
Closes the loop opened in [Phase 27](./phase-27-page-speed-baseline.md). See
[roadmap](./phases-27-33-roadmap.md).

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
