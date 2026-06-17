# Phase 34 — follow-up: relentless audit + before/after comparison (PAUSED)

Paused 2026-06-16 mid-audit at user request. Resume from here.

## Where things stand (DONE, committed on `design/magnetic`, NOT pushed)
- Phase 34 motion + anti-slop + polish: shipped (23 commits).
- `/shop/<slug>` 404 → redirect to `/category/<slug>`: shipped.
- ACID e2e teardown in `scripts/e2e.mjs`: shipped + verified (0 leaks on normal exit, Ctrl-C/SIGINT, SIGTERM, and crash-recovery reaper).
- Full `pnpm verify` GREEN (typecheck, lint, build, unit+95% coverage at 95.12% branches / 1973 tests, integration, smoke, e2e+axe).
- Plan moved to `docs/plans/done/` (phase-34-magnetic-design.md + step0-findings.md).
- After-state screenshots in `phase34-shots/after/` (untracked local artifact): 01-landing, 03/04 redirect proof.

## Relentless audit — status
- **Auditor A (storefront motion/anti-slop): RETURNED.** Triaged below.
- **Auditor B (admin refactors): RETURNED.** Triaged below.
- **Auditor C (polish / 404 / i18n / tests / e2e.mjs): DIED (500), was re-running when paused. MUST RE-RUN.**

### CONFIRMED fixes to make (from triaging A + B — these are real)
1. **HeroSection full-bleed text contrast (P1 regression).** Phase 2 changed the full-bleed hero overlay `text-white` → `text-primary-foreground`. That token is merchant-overridable, so a dark primary-fg makes hero text invisible on the `brightness-50` image. `text-white` there was an intentional legibility hardcode, NOT a DRY violation. → revert the full-bleed branch to `text-white` (keep `text-primary-foreground` only where it sits on the primary surface). File: `src/components/store/landing/HeroSection.tsx`.
2. **`useReveal` cleanup leaves `reveal-in` (P2).** Cleanup removes `reveal-init` but not `reveal-in`; on remount with a reused DOM node the element starts visible and the reveal never replays. → also `el.classList.remove('reveal-in')` in cleanup. File: `src/hooks/useReveal.ts`.
3. **`useCartPulse` spurious pulse on remount (P2).** If `lastAddedAt` is already non-zero (prior add) and a header remounts, the effect fires a pulse with no new add. → snapshot `lastAddedAt` in a ref at mount; only pulse when it INCREASES past the snapshot. File: `src/hooks/useCartPulse.ts`.
4. **Admin order optimistic state never reset + wrong rollback source (P2, real correctness).** `orders/[id]/page.tsx`: after a successful update `optimisticStatus`/`optimisticTracking` are never reset to null, so the badge shows the optimistic value for the rest of the session (masks server truth); and rollback captures the *optimistic* value, not `order.status`. → after success `setOptimistic*(null)` then `router.refresh()`; capture rollback from server `order.status`/tracking.
5. **ReviewsStrip lost `line-clamp` on body (P2).** De-card removed `line-clamp-4`; long reviews make very tall rows. → re-add a line clamp to the body `<p>`. File: `src/components/store/landing/ReviewsStrip.tsx`.
6. **CouponsTable AlertDialog rendered inside `<tr>` (P3).** Non-`<td>` child of `<tr>` (portaled content, so no visual break, but invalid nesting / dev warning). → hoist the AlertDialog out of the row into a fragment/parent. File: `src/components/admin/coupons/CouponsTable.tsx`.

### Optional / low-priority (decide on resume)
- `globals.css` `header-shrink` `animation-fill-mode: both` → `forwards` (avoid applying keyframe rest-state at scroll 0). Low impact.
- Vestigial `isAddingToCart` spinner in ProductHeroWrapper/ProductActions never renders (add is synchronous). Dead code cleanup, harmless.

### REJECTED auditor claims (false positives — do NOT act)
- "grayscale-on-hover is an anti-pattern" → it's the **documented DESIGN.md** product-image desaturate spec. Intentional.
- "@starting-style unsupported on Safari <17.5 = P0" → progressive enhancement, content visible without it. Not a bug.
- "staggerDelay cap groups cards at index 9+" → intentional `MAX_STAGGER_MS` cap.
- "view-transition + hero stagger compounding = P0" → speculative, unverified; check visually but not a confirmed bug.
- Admin delete handlers (product/variant/coupon), AlertDialog component, checkbox onCheckedChange coercion, useChartTheme SSR+reactivity → auditor B verified all CLEAN.

## Remaining execution plan (resume order)
1. **Re-run auditor C** (Sonnet) — polish/404/i18n/tests/e2e.mjs; focus on hollow tests + i18n `{placeholder}` empty-value rendering + FormField cloneElement + the e2e.mjs reaper isolation. Triage its findings.
2. **Apply the CONFIRMED fixes** (1–6 above, plus anything real from C). Delegate to ≤3 Sonnet agents on disjoint files; Opus reviews. Do NOT let parallel agents touch shared files (i18n/globals.css) concurrently — sequence those.
3. **Gate**: lint (0 warnings) + tsgo + targeted unit tests for touched files; one final `pnpm test:coverage` if branches could dip. Hand full `pnpm verify` to the USER.
4. **Commit** each fix as a small `fix(...)`/`refactor(...)` commit (user gives standing commit permission on this branch; never push).
5. **Before/after comparison** (user wants it): the old worktree seed throws `FOREIGN KEY constraint` (pre-phase-34 seed vs fresh local D1, NOT disk). Plan: run the **OLD frontend (`next dev` from a `pre-phase-34` worktree) against the CURRENT seeded worker** (the data layer is unchanged; only components differ) so no old-seed is needed — point the worktree's `NEXT_PUBLIC_WORKER_URL` at the running current worker, screenshot the same pages → `phase34-shots/before/`, diff against `after/`. Clean up the worktree afterward (`git worktree remove --force`, remove the node_modules symlink FIRST).

## Housekeeping on resume
- Verify `/tmp/sf-before` worktree is gone (`git worktree list`); if present, remove the node_modules symlink first, then `git worktree remove --force`, then `git worktree prune`.
- Confirm 0 leaked dev procs: `pgrep -f "wrangler.*worker/index.ts|workerd"`.
- `phase34-shots/` is an untracked local artifact — do not commit.
- User's pre-existing uncommitted files (`.gitignore` M, `repo-hygiene-remove-graphify-out.md`, `shop-flare-v0-pagespeed.pdf`) are NOT mine — never touch.
