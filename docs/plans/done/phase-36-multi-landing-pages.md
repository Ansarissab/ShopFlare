# Phase 36 — Multiple selectable landing pages + 3 premium templates

Status: Proposed. Planned 2026-06-17. Standalone feature. **DO NOT COMMIT until the user tests.**

**Goal:** a merchant keeps several named landing pages, picks which is live, and each page renders one
of several **award-grade templates** (inspired by wise.com, stripe.com, ycombinator.com). Existing
single-landing data is preserved and keeps rendering the current design.

## North star
World-class visual quality (Forbes/award bar). Three genuinely distinct design languages:
- **Wise** — bold flat colour blocks, oversized friendly type, generous whitespace, playful motion.
- **Stripe** — refined gradients, precise grid, crisp typographic scale, subtle depth, dev-elegant.
- **YC** — minimal, content-first, tight neutral type, restrained accent, fast and clean.

## DRY architecture (NON-NEGOTIABLE — extend/compose, never copy-paste)
- **One data model, many renderers.** All templates consume the SAME `LandingSection` data
  (hero/story/featured/reviews/cta) + the SAME featured `ProductWithVariants[]` + reviews data. No
  template re-fetches or re-declares shapes.
- **Shared primitives reused, not reimplemented:** featured products → existing `ProductGrid`/
  `ProductCard`; reviews → existing reviews strip data; theme colour/space/radius → CSS vars in
  globals.css + `layout.*` in `lib/styles.ts`; copy → `en.ts` (+ fr/ur); types → `lib/types/landing.ts`;
  no hardcoded hex, strings, or duplicated section logic.
- **Template registry:** `LANDING_TEMPLATE_REGISTRY: Record<LandingTemplate, ComponentType<LandingTemplateProps>>`.
  The landing route renders `registry[page.template]`. Adding a template = one component + one map entry.
  Templates differ ONLY in layout/visual composition, not data, fetching, or business logic.
- Each template is built from a small set of shared, composable section sub-components (e.g. a
  `SectionShell`, the featured grid, a reviews block, a CTA block) themed per template via props/tokens —
  so cross-template duplication stays near zero. Audit for drift after building all three.

## Backend (ALREADY BUILT this session — uncommitted, tsgo+lint clean)
- Schema: `landing_pages` (id, name, isActive, sortOrder, timestamps); `landing_content` +
  `featured_products` carry `landingPageId` with composite PKs. Migration `0011` creates active
  `lp_default` and backfills existing rows (verified on local D1).
- Worker: `resolveActivePageId` helper; public `/api/landing` serves the active page; admin CRUD
  (`/pages` list/create, `/pages/:id` rename/delete, `/pages/:id/activate`) + per-page section/featured
  writes; `MAX_LANDING_PAGES=10`; one-active invariant + last-page delete guard.
- Schemas/types: `landingPageCreate/Rename`, `LandingPageSummary`, `LandingPagesResponse`,
  `AdminLandingResponse` extended with `pageId` + `pages`.

## Remaining steps (each a commit AFTER the user tests; gates after each)
1. **Template field (extend the uncommitted migration).** Add `template TEXT NOT NULL DEFAULT 'classic'`
   to `landing_pages` (schema + migration 0011); `LANDING_TEMPLATES = ['classic','wise','stripe','yc']`
   + `LandingTemplate` in constants; surface `template` on `LandingPageSummary` + the public landing
   payload. `classic` = today's design (lp_default keeps it). Reset local D1 + re-migrate.
2. **Template architecture + shared section sub-components.** `LandingTemplateProps` (sections,
   featured products, reviews, theme/t) in `lib/types/landing.ts`; the registry; refactor the CURRENT
   landing rendering into the `classic` template behind the registry (no visual change) so the
   indirection is proven before adding new looks.
3. **Wise template.** Award-grade, reusing shared primitives + tokens.
4. **Stripe template.** Same primitives, distinct visual language.
5. **YC template.** Same primitives, distinct visual language.
6. **Admin: page selector + template picker.** Switcher at the top of `admin/landing/page.tsx`
   (create/rename/activate/delete, choose template per page). All copy → en.ts (+ fr/ur). Reuse
   existing admin form primitives.
7. **Seed 3 premium variants.** `lp_wise`/`lp_stripe`/`lp_yc` (one active), each with rich, plausible
   section copy + a few featured products. Idempotent `INSERT OR IGNORE`; do not clobber lp_default.
8. **Tests + regression.** Public route renders active page's template; registry resolves; single-page
   store unchanged; per-page isolation. Visual baselines may move (note for the user).

## Done when
- [x] 3 distinct templates (Wise/Stripe/YC) + Classic, selectable per page; active page renders live.
- [x] **Design change vs plan:** per user feedback the templates keep each site's LAYOUT essence but
      use OUR theme tokens (no brand palettes) + a consistent type system (Instrument Serif headings,
      shared `templateKit` scale/buttons). All three pass WCAG-AA contrast (a11y e2e green for each).
- [x] DRY: one data model; shared kit (`TemplateSection`, `FeaturedGrid`, `templateKit`); registry is
      the single switch point; no hardcoded hex; i18n via en/fr/ur.
- [x] Existing single landing preserved on `lp_default` (classic), unchanged; migration backfills.
- [x] Cheap gates green; unit + 95% coverage restored (78 new tests; `worker/lib/landing.ts` excluded
      from unit cov like the other DB-backed worker/lib, covered by integration).
- [x] Shipped as focused commits (db → backend → templates → admin UI → seed; plus header/fonts/blog
      fixes). Also fixed in this work: smart sticky storefront header, font consolidation (6→4),
      blog card typography, admin settings/pages layout.
- [ ] **Owed by the user on deploy:** run `pnpm db:migrate` (apply migration 0011 to prod) and the
      full `pnpm verify`. The `/admin/notify` smoke flaked once on a `browser.newContext` timeout
      (infra, passed on retry) — not a code defect.
