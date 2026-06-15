# Phase 31 — Keyboard shortcuts (Fizzy-style), both surfaces, full parity

Status: Done. Shipped 2026-06-15. Planned 2026-06-12 (grill-with-docs). Depends on
[Phase 28](./phase-28-i18n-locale-engine.md) (overlay strings via dictionaries) and
[Phase 29](./phase-29-header-search-nav-announcement.md) (`/` opens the search overlay). See
[roadmap](./phases-27-33-roadmap.md).

## Steps

1. **Engine (DRY, single source).** One shortcut engine in `lib` with a global listener, a
   sequence buffer + timeout, and an input-field guard (don't fire while typing in
   inputs/textareas/contenteditable; Esc always works). Bindings defined as data in
   `lib/constants`. Overlay strings via the i18n dictionaries.
2. **Vocabulary (full Fizzy).** Single keys (`/` search, `?` help, Esc close), `g`-then-key
   "go to" sequences, and `j`/`k` list navigation (needs active-row/selection tracking).
3. **Both surfaces, full parity.** Storefront + Admin Dashboard each get the full set and a
   `?` cheat-sheet overlay. Proposed keymap (finalize at build):
   - Admin: `g o` orders, `g p` products, `g c` coupons, `g a` analytics, `c` create,
     `/` search, `j/k` row nav, Esc close.
   - Store: `/` search overlay, `c` open cart, `?` help, Esc close.
4. RTL-aware overlay; respects `prefers-reduced-motion`. No Merchant config (universal UX,
   always on — not Feature-Flag-gated, not stored in D1).

## Done when

- [x] Both surfaces (storefront + admin) respond to the full keymap
- [x] `?` overlay lists shortcuts (localized, RTL-aware, respects `prefers-reduced-motion`)
- [x] Typing in inputs/textareas/contenteditable is unaffected; Esc always works
- [x] Engine, guard, dispatcher, and list-nav (`useListNavigation`) have regression tests
- [x] Gates green (lint + typecheck + unit + integration + smoke + e2e)

## As built (finalized keymap + decisions)

Engine: `lib/keyboard/dispatcher.ts` (pure matcher + input guard), `hooks/useKeyboardShortcuts.ts`
(window listener, sequence buffer + 1s timeout, Esc bypasses the input guard), bindings as data in
`lib/constants/shortcuts.ts`, strings in `lib/i18n/{en,fr,ur}.ts`. Shared `?` overlay
`components/shared/ShortcutsHelpOverlay.tsx` (+ `hooks/useReducedMotion.ts`). Mounted via
`StoreShortcuts` (in `SearchProvider`) and `AdminShortcuts` (in `AdminShell`). Always-on — not a
Feature Flag, not in D1.

- **Store:** `/` search overlay · `c` cart · `?` help · `Esc` close.
- **Admin:** `g o/p/c/a` go-to · `?` help · `Esc` close · `j`/`k`/`Enter` row nav · `c` create ·
  `/` search.
  - `/` opens a new minimal global admin search (`components/admin/shared/AdminSearch.tsx`,
    `[data-shortcut-search]`, products + orders, links to detail). Admin had no search surface
    before, so it was built to make `/` meaningful.
  - `j`/`k`/`Enter` row nav implemented generically (`useListNavigation` + `ListNavContext`) and
    wired into **all** admin lists: orders, products, coupons, categories, reviews, blog, pages,
    restock. `Enter` opens the detail route where one exists, else the row's edit action or a safe
    no-op (coupons → edit; reviews/restock → no-op).
  - `c` create is context-aware via `ADMIN_CREATE_ROUTES`; only Products + Categories have create
    routes, so it is a no-op on lists without one (by design).
- E2E coverage added: `e2e/store/keyboard-shortcuts.spec.ts` + `e2e/admin/keyboard-shortcuts.spec.ts`.
