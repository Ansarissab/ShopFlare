# SEO / GEO / AEO + LLM-Readable Pages

Phase 21 makes every public Store page maximally legible to classic search engines,
AI answer engines (Google AI Overviews, Perplexity, ChatGPT-Search), and LLMs that
fetch pages directly — at $0 cost.

---

## What is emitted

### Server-rendered metadata (all pages)

Every public route exports `generateMetadata` that calls `buildPageMetadata` in
`src/lib/seo/metadata.ts`. This sets `<title>`, `<meta name="description">`,
OpenGraph, Twitter card, and `<link rel="canonical">` in the initial server HTML.

| Route | Title | Description | Canonical |
|---|---|---|---|
| `/` (home) | store name + tagline | tagline | `/` |
| `/product/[slug]` | product name | product description (≤155 chars) | `/product/{slug}` |
| `/category/[slug]` | category name | category description | `/category/{slug}` |
| `/policy/[slug]` | page title | first ~155 chars of body, HTML-stripped | `/policy/{slug}` |

### Server JSON-LD (all pages)

Structured data is emitted as `<script type="application/ld+json">` in the **server
HTML** (not injected by client JS). Builders live in `src/lib/seo/jsonld.ts`.

| Page | Schemas emitted |
|---|---|
| Layout (sitewide) | `Organization` with stable `@id: {siteUrl}#org` |
| Product | `Product` + `Offer`/`AggregateOffer` + `AggregateRating` (when reviews exist) + `BreadcrumbList` |
| Category | `CollectionPage` + `BreadcrumbList` |
| Policy | `WebPage` + `BreadcrumbList` |

Entity consistency: the Product's `brand` references the same Organization `@id`
(`{siteUrl}#org`), forming a single entity graph for answer-engine trust.

### Sitemap

`src/app/sitemap.ts` (1 h revalidate) includes all products, categories, and policy
pages. Products and policy pages carry `lastModified` from their `updatedAt` timestamp
(freshness signal for AEO). Blog routes are scaffolded as a TODO for phase 23.

---

## Flag matrix

| Feature | Always on | Gated by `llmDiscoveryEnabled` |
|---|---|---|
| Per-page metadata (title/desc/OG/canonical) | ✓ | |
| Server JSON-LD (Product/Offer/Rating/Org/Breadcrumb/FAQPage) | ✓ | |
| Sitemap + classic robots policy | ✓ | |
| `.md` twins + `rel=alternate` advertisement | ✓ | |
| `/llms.txt` | | ✓ (404 when off) |
| AI-bot stanzas in robots.txt (search + training lines) | | ✓ (omitted when off) |

The `aiTrainingAllowed` flag is a sub-choice that only matters while `llmDiscoveryEnabled`
is on — it governs whether training bots (GPTBot, CCBot, etc.) are allowed or blocked.

---

## LLM discovery routes

### `/llms.txt`

Dynamic route at `src/app/llms.txt/route.ts`. Returns `text/plain` with:
- Store name and tagline
- `## Products` — up to 50 linked products with short descriptions
- `## Categories` — all categories with descriptions
- `## Policies` — all policy pages

Returns `404` when `llmDiscoveryEnabled` is false.

### Markdown twins (`.md` suffix)

Each public page has a `.md` counterpart that returns the same content serialized to
Markdown:

| URL | Handler |
|---|---|
| `/product/{slug}.md` | `src/app/(store)/product/[slug].md/route.ts` |
| `/category/{slug}.md` | `src/app/(store)/category/[slug].md/route.ts` |
| `/policy/{slug}.md` | `src/app/(store)/policy/[slug].md/route.ts` |

The markdown serializer lives in `src/lib/markdown.ts` — one shared serializer, no
duplication per page type.

Advertised via:
- `<link rel="alternate" type="text/markdown" href="{url}.md">` in `<head>`
- `Link: <{url}.md>; rel="alternate"; type="text/markdown"` response header

**No User-Agent sniffing.** The same URL serves the same content to everyone; only the
explicit `.md` suffix (or `Accept: text/markdown` — see below) changes the format.
UA-based content swaps = cloaking, which is penalized.

### `Accept: text/markdown` content negotiation

The `.md` routes also respond to `GET /product/{slug}.md` regardless of `Accept`. For
full content negotiation (serving markdown at the canonical URL when `Accept: text/markdown`
is sent), a middleware rewrite would be needed — this is a TODO (the `.md` suffix URL
is the primary mechanism and covers all current use cases).

---

## robots.txt AI-bot policy

Dynamic route at `src/app/robots.txt/route.ts` (replaces the old static `robots.ts`).

When `llmDiscoveryEnabled` is on:
- **AI search/answer bots** (`AI_SEARCH_BOTS` constant) are always allowed — these
  power citations buyers see in AI Overviews, Perplexity, etc.
- **Training bots** (`AI_TRAINING_BOTS` constant) are allowed or blocked per
  `aiTrainingAllowed` flag (admin-controlled, default: allowed).
- When training is blocked, a `# Content-Signal: ai-train=no` comment is added.

When `llmDiscoveryEnabled` is off, the AI-bot stanzas are omitted entirely.

SEO scrapers (`BLOCKED_SCRAPER_BOTS`: AhrefsBot, SemrushBot, MJ12bot, DotBot) are
always blocked.

---

## FAQ authoring convention

FAQ content is stored in `store_config` as a Trix HTML string under the key `faqContent`.
Toggle via `faqEnabled`. Edited in Admin → Settings → "SEO / LLM Discovery".

Parsing convention (for `faqPageJsonLd`):
- **`<h3>` or `<h4>` tag** = question
- **Following paragraph block** = answer

Keep the same Q&A visible on the page — the visible HTML and the JSON-LD must match.
Mismatched FAQ schema is treated as a spam signal.

Per-product FAQ is deferred to a follow-up (sitewide-only ships in v1).

---

## Validator results

Run these tools after deploy to verify structured data:

- [Rich Results Test](https://search.google.com/test/rich-results) — product pages
  should show Product + Offer + Rating (when reviews exist).
- [Schema Markup Validator](https://validator.schema.org) — all page types.
- Lighthouse SEO audit → expect ≈ 100.

Note: Google dropped FAQ *rich-result display* in May 2026, but FAQPage schema still
feeds AI answer extraction — keep it.

---

## No-cloaking guarantee

The rule: the same URL returns the same content to all callers. Format changes only via:
1. Explicit `.md` URL suffix
2. `Accept: text/markdown` header (TODO for full negotiation)

Never branch on `User-Agent`. See ADR 0013 for the rationale.
