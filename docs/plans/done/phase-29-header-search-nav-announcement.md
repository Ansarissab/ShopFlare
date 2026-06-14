# Phase 29 — Header cluster: search overlay + navigation + announcement bar

Status: Done. Shipped 2026-06-14 (relentless audit + fixes + `pnpm verify` green). Depends on
[Phase 28](./phase-28-i18n-locale-engine.md) (RTL-aware, strings via dictionaries). See
[roadmap](./phases-27-33-roadmap.md).

All top-of-page work is batched: search, nav, the Locale switcher slot (from Phase 28), and
the announcement bar contend for the same header and must be designed together.

## 29a — Global search Overlay (product search + filter ONLY)

- Header search control (and the `/` shortcut from Phase 31) opens a modal **Overlay** that
  Fuse-searches the **full catalog** (fetched once via a lightweight search endpoint,
  cached); results are **always Products** and link straight to the product. Works from any
  page.
- **Not a command palette** — it never fires app actions/navigation commands. Products only.
- The Overlay carries the existing category + in-stock filters, so search and filter live in
  one place. Keep `?q=` shareability. **Lazy-load** `fuse.js` + the overlay (perf).
- The in-grid `SearchBar` filter stays on catalog/category pages for narrowing the loaded
  list (`src/components/store/Catalog.tsx`,
  `src/components/store/categories/CategoryProductSection.tsx`).
- Updates the `Product Search` concept already revised in CONTEXT.md.

## 29b — Navigation: desktop bar + mobile drawer

- Desktop header: logo | primary links (Shop, Categories, Track, FAQ, Blog*) | search btn |
  Locale switcher | cart.
- Mobile: logo | search | cart, with a hamburger opening a drawer holding the links + Locale
  switcher.
- `*` feature-flag-gated: Blog, FAQ. Categories come from `/api/categories` (`CategoryNav`).
- RTL-mirrored (Phase 28).

## 29c — Announcement Bar

- Thin bar above the header. Feature-Flag-gated, Merchant-controlled in Store Config.
- Merchant picks a **type**: single | scheduled (auto show/hide between start/end datetime) |
  rotating (multiple messages). Each message: text + optional link + optional color.
- Customer-dismissible; dismissal keyed to **message version** so a *new* announcement
  re-shows. Persist via cookie.
- Rotating carousel must be **CSS-driven** (no heavy JS lib), respect
  `prefers-reduced-motion`, and be accessible — protect the 95+ gate.
- Text is Merchant content → **not** Locale-translated this phase.

## Done when

Search overlay works from any page (lazy-loaded), nav works on desktop + mobile + RTL,
announcement bar configurable in all three types + dismissible, gates green.
