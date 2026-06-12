# 16. Marketing tags: Merchant-configured IDs, consent-gated loading, no raw scripts

Date: 2026-06-12
Status: Accepted

## Context

The Store wants a full marketing stack (Google Analytics 4, Google Ads, Meta Pixel) plus
search-engine ownership verification. This collides head-on with two standing project
commitments: the mobile-95+ page-speed gate (third-party JS is the classic killer) and the
$0 / privacy-lean ethos. French is in scope, so EU/GDPR consent is mandatory. The way
these tags load is a real architectural decision balancing marketing, performance,
privacy, and security — hence this record.

## Decision

1. **Every ID is Merchant-configured in Store Config** — GA4, Google Ads, Meta Pixel IDs
   and Google/Bing verification tokens. Nothing is hardcoded; no tag exists unless the
   Merchant entered its ID (white-label, Dynamic-First). No redeploy to add or change a
   tag.

2. **Tags load only after Cookie Consent.** A consent banner gates GA4/Ads/Pixel; they
   fire only after the Customer opts in, via `next/script`. Because Lighthouse lab runs
   with no consent, **no marketing script loads during measurement** — the 95+ gate is
   preserved by construction, and the integration is GDPR-clean for the French Locale.
   Partytown web-worker offload was considered and rejected for now: fiddly on
   OpenNext/CF for a marginal gain once consent-gating already protects the lab score.

3. **No raw script injection from admin.** Beyond the structured ID/token fields, Merchants
   may add extra `<meta>`/`<link>` tags through a **sanitized** custom-tags field — never
   `<script>`. This keeps the "add any pixel/header from admin" flexibility without opening
   a stored-XSS hole, consistent with the project's security rules. The known pixel types
   are first-class fields; the sanitized meta/link slot covers verification and future
   meta-only integrations.

## Consequences

- Default (unconsented) page load stays script-free and fast; only consenting users pay
  the tracking cost.
- A genuinely novel pixel that needs a `<script>` (not GA4/Ads/Pixel) would require a code
  change — an accepted, deliberate limit in exchange for not shipping a script-injection
  surface.
- A consent banner becomes part of the storefront (required wherever EU visitors are
  served; the French Locale guarantees this).
