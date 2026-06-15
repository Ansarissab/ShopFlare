# Phase 32 — Marketing & SEO (full stack, consent-gated)

Status: Done. Shipped 2026-06-15 (Opus-orchestrated, Sonnet execution, 3-reviewer
adversarial audit). Planned 2026-06-12 (grill-with-docs). Implements
[ADR 0016](../../adr/0016-consent-gated-marketing-tags.md). Depends on
[Phase 28](./phase-28-i18n-locale-engine.md) (Locales must exist for hreflang). See
[roadmap](./phases-27-33-roadmap.md).

Current SEO infra: `src/app/sitemap.ts`, `robots.txt`, `llms.txt`, server metadata
(ADR 0011), JSON-LD. No verification, no analytics tags, no hreflang. Config schema has no
SEO fields. Add what's missing only — don't re-propose existing infra.

## Steps

1. **Site Verification.** Store Config fields for Google Search Console + Bing tokens →
   rendered verification meta tags. Plus a **sanitized** custom-tags field allowing only
   `<meta>` / `<link>` (never `<script>` — security).
2. **Marketing Tags.** Store Config fields for GA4, Google Ads, Meta Pixel IDs. Tags load
   **only after Cookie Consent**, via `next/script`. No ID set → no tag fires. All
   Merchant-configured (white-label, Dynamic-First).
3. **Cookie Consent banner.** Required wherever EU visitors are served (the French Locale
   guarantees this). Gates all Marketing Tags. Lab measurement runs unconsented → no scripts
   → the 95+ gate is preserved by construction.
4. **hreflang + locale sitemap.** Emit `hreflang` alternates for enabled Locales; extend
   `sitemap.ts` with per-Locale URLs.
5. **IndexNow.** Auto-ping IndexNow on Product changes (CF-native, $0) so Bing/search
   engines re-crawl fast.

## Matches CONTEXT terms

Marketing Tag, Site Verification, Cookie Consent.

## Done when

Merchant can verify GSC/Bing + configure GA4/Ads/Pixel from admin, tags fire only
post-consent, hreflang + locale sitemap emitted, IndexNow pings on product change, gates
green.
