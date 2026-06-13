# Phase 34 — Magnetic design pass (interactive · modern · anti-slop)

Status: Proposed. Planned 2026-06-12. Standalone track (not part of the 27–33 batch). Builds
directly on the shipped premium-editorial system (see [DESIGN.md](../../../DESIGN.md)): Instrument
Serif + Geist, warm-paper neutrals + oxidized-copper accent, editorial image-forward product cards,
product-page dossier, poster landing hero, WCAG-AA, full gate green.

**Goal:** make the storefront + landing feel *interactive and magnetic* — motion that pulls,
modern polish — while staying verifiably free of AI slop and without regressing the gates or the
merchant token system.

## Hard constraints (non-negotiable)

- **$0.** No paid services, no paid MCP (TypeUI is explicitly OUT — $30/mo violates $0), no new
  hosted dependency. Stays on the Cloudflare free tier.
- **No JS animation library.** Motion uses native CSS only — `@starting-style`, CSS transitions,
  `IntersectionObserver`, and the View Transitions API. No Framer Motion / GSAP (bundle weight +
  conflicts with the Phase 27 page-speed gate).
- **`transform`/`opacity` only** for animation (no layout-thrashing props), every motion
  `prefers-reduced-motion`-gated.
- **Merchant token system intact** — only defaults/components change; the 2-color override
  (`--store-primary`/`--store-accent`) keeps working.
- **Gates stay green** — typecheck, lint, unit + 95% coverage, integration, e2e **incl. a11y**
  (re-run axe; motion/color can affect contrast + reduced-motion). No `git push`, no deploy.

## Tooling

- **impeccable** (`impeccable.style`, GitHub `pbakaus/impeccable`) — free Claude Code design skill:
  designer's vocabulary + **41 deterministic anti-slop rules**, token-aware. Install:
  `npx skills add pbakaus/impeccable`. Inspect exactly what it writes before use. **Free → fits $0.**
- **MotionSites** (`motionsites.ai`) — **reference only** (paid template service, not installable).
  Study its motion patterns by eye; reimplement tasteful ones in our own stack. Nothing installed.
- **TypeUI** (`typeui.sh`) — **out of scope** (paid MCP, violates $0).

## Steps

0. **Install + audit (no design changes).** `npx skills add pbakaus/impeccable`; show what it added.
   Run its 41-rule anti-slop detection + design audit on storefront / landing / product / admin.
   Study MotionSites by eye; extract 4–6 reusable, $0-compatible motion patterns. **Output: a
   findings + motion doc — reviewed before any code changes.**
1. **Motion / interaction layer (the "magnetic" part).** Scroll-reveal for landing sections;
   refined hero entrance; product-card hover polish + an add-to-cart **confirmation**
   micro-interaction (folds in the no-op `isAddingToCart` bug); sticky-header shrink-on-scroll;
   subtle View-Transitions page changes. **Motion budget rule:** every animation communicates
   something — no decoration.
2. **Anti-slop hardening.** Apply impeccable's rules: tokenize remaining magic spacing (earlier
   audit finding), tighten type scale + radius hierarchy, enforce shadow restraint, confirm no
   centered-everything / decorative-blob / generic-grid patterns.
3. **Magnetic storefront/landing polish.** Stronger first impression: elevate the poster hero with
   motion + a clearer visual anchor; refine product-grid rhythm + empty/loading states. Sweep the
   low-severity cosmetic items logged earlier (radio-group arrow-keys, "Coming Soon"-vs-error,
   hardcoded success-page strings) since they live in the same files.
4. **Verify + ship.** Full gate green (re-run a11y/axe), **before/after live screenshots**, one
   focused commit per coherent change, temp cleanup. No push/deploy.

## Reversibility (how to undo it without losing code)

- **Preferred — separate branch.** The agent never creates branches (project rule); **you** create
  `design/magnetic` (`git checkout -b design/magnetic`) and all Phase 34 work happens there. Dislike
  it → `git checkout main` + delete the branch. main is untouched, **zero code lost**.
- **Restore-point tag.** Before Phase 1, tag the current commit (e.g. `git tag pre-phase-34`) — a
  named anchor to return to (`git reset --hard pre-phase-34` on the work branch).
- **Commit-per-wave.** Each change is one isolated `feat(design)/fix(...)` commit, so any subset is
  individually `git revert`-able. Everything lives in history; nothing is destructive.

## Done when

impeccable installed + audit captured; motion + anti-slop + polish shipped on a branch you can
discard; gates green incl. a11y; before/after screenshots recorded; restore-point tag in place;
nothing pushed or deployed.
