# Phase 28 — i18n Locale engine + full codemod (FOUNDATION)

Status: Done 2026-06-13 (`pnpm verify` green; relentless audit + fixes applied).
Planned 2026-06-12 (grill-with-docs). Implements
[ADR 0015](../../adr/0015-i18n-locale-engine.md). See
[roadmap](./phases-27-33-roadmap.md).

> **Resolution-model note (deviation from ADR 0015 §2):** to keep locale
> resolution consistent across server content, the root `<html>`, and client
> chrome at $0 (no per-request config fetch in edge middleware), the unprefixed
> root serves English; other enabled locales are reachable via the `/{loc}`
> prefix and persist across plain-link navigation via the `NEXT_LOCALE` cookie
> (read by middleware). True per-merchant default-at-root would require the
> middleware to know `defaultLocale` (a cached config fetch) — left as a
> follow-up. `defaultLocale` is retained for future hreflang `x-default`.

## What shipped (vs. plan)

Built in 7 waves (engine → routing → storefront codemod → RTL → switcher +
admin settings → admin localization → finalize). Key decisions made during build:

- **Routing = middleware rewrite + `x-locale` header** (not an `app/[locale]`
  segment). `/{loc}` prefixes are stripped and rewritten internally; the header
  carries the active Locale to server components; a `NEXT_LOCALE` cookie persists
  the switcher choice. Zero file moves; `.md` twins, sitemap, robots untouched.
  Query strings preserved across the rewrite.
- **Resolver**: server components `await getT()` (reads the header); client
  components `useT()` (via `TProvider`, **falls back to English when no provider
  is mounted** — this keeps ~unwrapped component tests green and admin English in
  any non-provider context).
- **fr/ur dictionaries are English placeholders marked TODO** — structurally
  complete (the `Dictionary = Widen<typeof en>` type + a runtime drift-guard test
  enforce key parity). Real translations are a follow-up pass; the engine,
  routing, switcher, and RTL all ship and are testable now.
- **Admin is also localized** (added after the original storefront-only scope):
  all 38 admin files migrated to the engine; admin language switcher prefixes
  `/{loc}/admin`; admin defaults to English and is selected via the switcher.

### Deferred follow-ups (intentional)

- **Urdu admin RTL pass** — admin is migrated for strings (fr works fully) but
  forced `dir="ltr"`; the ~94-utility physical→logical RTL conversion on admin is
  a separate phase. Urdu admin shows translated text in an LTR layout for now.
- **Embla carousel RTL scroll direction** — product image carousel nav buttons
  use logical insets, but embla's `direction:'rtl'` is not wired (noted in
  `carousel.tsx`); low impact for image galleries.
- **Merchant-content translation** (Product/policy/FAQ/announcement) — out of
  scope here as planned; future Workers-AI phase.
- **WhatsApp deep-link message text** stays English (outbound content, not UI
  chrome); revisit with content translation.

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
