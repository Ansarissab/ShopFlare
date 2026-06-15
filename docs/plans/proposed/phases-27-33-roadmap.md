# Phases 27–33 — Feature batch roadmap

Status: Proposed. Planned 2026-06-12 via a grill-with-docs session. Index only — each phase
is its own file, executable in its own session, in this order (dependency-optimal).

Companion docs: CONTEXT.md (new terms: Locale, Locale Switcher, FAQ, Marketing Tag, Site
Verification, Cookie Consent, Announcement Bar), [ADR 0015](../../adr/0015-i18n-locale-engine.md),
[ADR 0016](../../adr/0016-consent-gated-marketing-tags.md).

| Order | Phase | File |
|-------|-------|------|
| 1 | Page-speed baseline + quick wins ✅ done | [phase-27](../done/phase-27-page-speed-baseline.md) |
| 2 | i18n Locale engine + codemod (foundation) | [phase-28](./phase-28-i18n-locale-engine.md) |
| 3 | Header cluster: search + nav + announcement bar | [phase-29](./phase-29-header-search-nav-announcement.md) |
| 4 | FAQ: structured, /faq, per-product, accordion | [phase-30](./phase-30-faq-structured.md) |
| 5 | Keyboard shortcuts (Fizzy-style) ✅ done | [phase-31](../done/phase-31-keyboard-shortcuts.md) |
| 6 | Marketing & SEO (consent-gated) | [phase-32](./phase-32-marketing-seo.md) |
| 7 | Final page-speed gate (all Locales) | [phase-33](./phase-33-final-page-speed-gate.md) |

## Why this order

- **i18n is foundational** — every later phase writes strings into it; doing it first avoids
  re-touching components twice.
- **Header is a contention zone** — search, nav, Locale switcher, announcement bar all live
  at the top of the page → one phase.
- **hreflang (Phase 32) needs Locales** (Phase 28) to exist.
- **Perf brackets the batch** — baseline first (Phase 27), re-gate last (Phase 33).

## Cross-cutting rules (every phase)

- DRY: extend existing helpers/schemas/styles; strings in dictionaries, colors in CSS vars,
  types from Drizzle, network via `lib/api.ts`. No inlined schemas/strings.
- Dynamic-First: anything Merchant-editable (Locales, FAQ, announcement, tags, verification)
  lives in D1 / Store Config, no redeploy.
- Security: no raw card data, no raw `<script>` injection from admin, sanitize custom tags.
- Tests: every fixed/added behavior gets a regression test in the right layer; keep
  `pnpm verify` + 95% coverage green.

## Maps to original request

1 shortcuts → P31 · 2 search/nav → P29 · 3 FAQ → P30 · 4 i18n → P28 · 5 page speed →
P27+P33 · 6 marketing/SEO → P32 · 7 announcement bar (added mid-session) → P29.
