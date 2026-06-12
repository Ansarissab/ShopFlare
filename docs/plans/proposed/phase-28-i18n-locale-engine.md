# Phase 28 — i18n Locale engine + full codemod (FOUNDATION)

Status: Proposed. Planned 2026-06-12 (grill-with-docs). Implements
[ADR 0015](../../adr/0015-i18n-locale-engine.md). See
[roadmap](./phases-27-33-roadmap.md).

**Scope: UI chrome only.** Merchant-content translation (Product text, policies, FAQ,
announcement bar) is explicitly out of scope — a future phase using Cloudflare Workers AI
(`@cf/meta/m2m100-1.2b`) at save-time, cached in D1. Do not attempt content translation here.

Foundational: every later phase (29–32) writes strings into this engine. Out-of-order work
re-touches the same files twice.

## Background (current state)

`src/lib/i18n/en.ts` is a single typed object imported **directly in ~149 files** as
`en.store.x`. No `t()` indirection, no locale routing, no second language.

## Steps

1. **Engine.** Keep `en.ts` as the canonical, typed *shape*. Add `fr` and `ur` dictionaries
   conforming to it (TypeScript enforces key completeness). One resolver: server components
   resolve the active dictionary from the route Locale; client components via a
   provider/hook (`useT()`) seeded by SSR.
2. **Routing.** Path-prefix (`/fr`, `/ur`); the Merchant's default Locale serves the
   unprefixed `/`. Middleware maps prefix → active Locale. Keep `?q=` and existing `/`
   links/bookmarks working.
3. **Store Config.** Add `enabledLocales` (⊆ shipped set) + `defaultLocale`. Admin UI to
   toggle enabled Locales + choose default. No redeploy (Dynamic-First).
4. **Locale Switcher.** Header dropdown, shown only when >1 Locale enabled. Switching
   navigates to the prefixed URL and writes a cookie (persists across pages/visits). First
   visit → default Locale (no auto-detection).
5. **Codemod.** Migrate all ~149 `en.` call sites → `t.` in one scripted pass (full
   migration, no English-fallback interim — the suite + 95% gate guard it). Add `useT()` in
   client components / dictionary resolution in server components.
6. **RTL.** `dir="rtl"` for `ur`. Codemod Tailwind physical → logical utilities
   (`pl-`→`ps-`, `left-`→`start-`, `ml-`→`ms-`, `text-left`→`text-start`, etc.) — physical
   utilities do **not** auto-flip. Audit `SearchBar`, `AppHeader`, header, cart, product,
   checkout.
7. **Urdu font.** Noto Nastaliq Urdu, self-hosted woff2, `font-display: swap`, **not**
   preloaded, **not** render-blocking, loaded **only on `/ur`** (e.g. `next/font/local`
   scoped to the Urdu layout) so a fallback paints instantly and the perf gate survives.
8. **fr/ur content.** Machine-translate `en.ts` once, mark for human review. Keys identical
   to the `en` shape.

## Dependency for

hreflang + locale sitemap (Phase 32), shortcut overlay strings (Phase 31), all later UI.

## Done when

Engine + routing + switcher live, all 149 sites migrated, fr+ur chrome renders, `/ur` is
RTL with the scoped font, `pnpm verify` + 95% coverage green.
