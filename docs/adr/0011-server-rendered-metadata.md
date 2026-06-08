# 11. Public pages render metadata + structured data server-side

Date: 2026-06-08
Status: Accepted

## Context

The storefront's product, category, and policy pages are `'use client'` components.
Per-page `<title>`, description, Open Graph tags, and JSON-LD are injected after
hydration. The root layout's `generateMetadata()` is the only server-rendered metadata.

Crawlers and answer engines (Googlebot, GPTBot/OAI-SearchBot, ClaudeBot/Claude-SearchBot,
PerplexityBot, Google AI Overviews) read the initial server HTML and frequently do not
execute or wait for client-side hydration. So today our per-page SEO signals — titles,
descriptions, canonical, OG, and the Product/Offer/AggregateRating JSON-LD that AI
shopping agents consume — are largely invisible to them. Items #4 (LLM pages), #7
(SEO/GEO/AEO), #8 (blog), and #3 (landing) all depend on this being fixed; 2026 research
is consistent that **server-rendered JSON-LD is the single highest-ROI lever** and that
Google's I/O 2026 agentic-shopping features act on server-rendered Product/Offer data.

## Decision

Convert public, indexable pages (product, category, policy, and the new blog/landing
pages) so the route is a **Server Component** that:

- exports `generateMetadata()` (title, description, canonical, OG/Twitter) built from D1
  via a shared `lib/seo` helper, and
- renders JSON-LD and critical above-the-fold content in the server HTML,
- delegating interactivity (cart, variant/size selection, forms) to an inner
  `'use client'` island that receives server-fetched data as props.

JSON-LD builders (Product, Offer, AggregateRating, Organization, BreadcrumbList,
FAQPage, Article) live once in `lib/seo` and are reused across pages. Admin/track/checkout
pages stay client-rendered (not indexable, behind interactivity).

## Consequences

- Per-page metadata + structured data appear in initial HTML → visible to search engines
  and answer engines; enables Google merchant listings and AI citations.
- Values derive from D1 (price, stock, name), so the Dynamic-First rule holds — merchant
  edits propagate to schema without redeploy.
- More refactor up front: each converted page splits into a server shell + client island,
  and data fetching moves server-side. This is one-time and gated behind tests.
- OpenNext already runs these as Workers (ADR 0009), so SSR cost stays within the free
  pool; static-enough pages still prerender to Workers Static Assets.
- Client-injected JSON-LD components are removed to avoid duplicate/late schema.
</content>
