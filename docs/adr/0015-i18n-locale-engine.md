# 15. Generic Locale engine: path-prefix routing, chrome-only scope, content deferred to Workers AI

Date: 2026-06-12
Status: Accepted

## Context

The storefront ships a single English dictionary (`src/lib/i18n/en.ts`) imported
**directly in ~149 files** as `en.store.x` — there is no `t()` indirection, no locale
routing, no second language. We want French and Urdu. Urdu adds right-to-left layout and
a heavy Nastaliq font. The decision is hard to reverse (it sets the URL structure and a
codemod across the whole component tree) and full of genuine trade-offs (where the Locale
lives, what gets translated, how to stay $0), so it is recorded here.

## Decision

1. **Generic engine, not N hardcoded dictionaries.** `en.ts` remains the canonical,
   typed *shape*. `fr` and `ur` are data conforming to that shape. One resolver returns
   the active dictionary; server components resolve it from the route Locale, client
   components from a provider/hook seeded by SSR. The ~149 sites migrate `en.` → `t.` in a
   single scripted codemod (full migration, no English-fallback interim — the test suite
   and 95% gate guard it).

2. **Locale lives in the URL path prefix** (`/fr/...`, `/ur/...`); the Merchant's default
   Locale serves the unprefixed root. Chosen over a cookie-only scheme because translated
   pages must be independently indexable with `hreflang` (the SEO goal) — a cookie serves
   all languages from one URL and is invisible to crawlers. Subdomains were rejected:
   they don't exist on `*.workers.dev` and break the two-worker cookie model (ADR 0014).

3. **Merchant controls Locales in Store Config** (`enabledLocales` ⊆ shipped set,
   `defaultLocale`) — consistent with the Dynamic-First Rule and Feature Flags. A
   Pakistani Merchant enables en+ur, a French one en+fr; unused shipped Locales stay
   hidden. A Customer-facing Locale Switcher (header dropdown, cookie-persisted, shown only
   when >1 Locale is enabled) lets the Customer choose; first visit starts on the default
   (no auto-detection).

4. **Scope is UI chrome only, for now.** The engine translates the static `en.ts`
   interface strings. Merchant-authored content (Product text, policies, FAQ, announcement
   bar) is **not** translated in this phase. Translating that content later will use
   **Cloudflare Workers AI** (`@cf/meta/m2m100-1.2b`) at *save-time* in the admin, cached
   in D1 — the only mechanism that keeps "$0" while covering dynamic content. Paid
   translation APIs break $0; manual per-locale entry punishes a non-developer Merchant.
   Splitting chrome (now) from content (later) keeps the first delivery shippable.

5. **RTL is a mechanical codemod + scoped font.** `dir="rtl"` per Locale, plus swapping
   Tailwind physical utilities (`pl-`, `left-`, `ml-`) for logical ones (`ps-`, `start-`,
   `ms-`) — Tailwind physical utilities do not auto-flip. The Urdu font is **Noto Nastaliq
   Urdu**, self-hosted woff2, `font-display: swap`, **not** preloaded and **not**
   render-blocking, loaded **only on `/ur` routes** — so a fallback paints instantly and
   the page-speed gate survives (see the performance budget in the phase plan).

## Consequences

- A single codemod touches ~149 files; reviewed behaviourally by the existing suite.
- `?q=` search-share URLs and existing `/` bookmarks keep working (default Locale is
  unprefixed).
- A future "translate Merchant content" capability is a known, separate phase with a
  known $0 mechanism (Workers AI), not an open question.
- Urdu pages accept a brief font swap (FOUT) as the price of hitting the speed gate.
