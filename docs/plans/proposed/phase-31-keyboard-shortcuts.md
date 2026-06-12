# Phase 31 — Keyboard shortcuts (Fizzy-style), both surfaces, full parity

Status: Proposed. Planned 2026-06-12 (grill-with-docs). Depends on
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

Both surfaces respond to the full keymap, `?` overlay lists shortcuts (localized), typing in
fields is unaffected, gates green + regression tests for the dispatcher/guard.
