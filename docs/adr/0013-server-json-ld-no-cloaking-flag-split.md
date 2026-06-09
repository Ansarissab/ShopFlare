# ADR 0013 — Server JSON-LD, no-cloaking, and `llmDiscoveryEnabled` flag split

**Status:** Accepted  
**Phase:** 21 (SEO / GEO / AEO + LLM Discovery)

---

## Context

Phase 21 makes all public store pages legible to classic search engines, AI answer
engines, and LLMs. Three architectural decisions were locked during design:

1. Where to emit structured data (JSON-LD)
2. How to serve alternate content formats to LLMs
3. What the `llmDiscoveryEnabled` flag should and should not gate

---

## Decision 1 — Server-rendered JSON-LD only

All `<script type="application/ld+json">` is emitted in the **server HTML response**,
not injected by client JavaScript.

**Why:** Classic crawlers and AI answer engines often render only the initial HTTP
response HTML. Client-injected JSON-LD (the prior approach in `ProductJsonLd.tsx`) is
unreliable — the structured data is invisible to renderers that don't execute JS.

**Consequence:** `ProductJsonLd.tsx` and the inline `CategoryJsonLd` were deleted.
Data previously fetched client-side (currency, review aggregate) is now fetched
server-side in the page's existing data load and passed to the shared builders in
`src/lib/seo/jsonld.ts`.

---

## Decision 2 — No User-Agent sniffing (cloaking guardrail)

Markdown content is served via an explicit `.md` URL suffix (`/product/abc.md`) and/or
the `Accept: text/markdown` request header. **Never** by detecting `User-Agent`.

**Why:** Serving different content to bots vs. humans based on User-Agent is cloaking —
a practice that violates search engine guidelines and can result in de-indexing. The
`.md` suffix and `Accept` header are format negotiation, not bot detection; a human
can use both, and a bot can use either.

**Consequence:** The markdown alternate is advertised via `<link rel="alternate"
type="text/markdown">` in `<head>` and a `Link:` response header — both of which
inform any caller (human or bot) that the alternate exists, without any UA check.

---

## Decision 3 — Flag split: SEO always on, AI-discovery extras gated

`llmDiscoveryEnabled` gates only the "AI discovery extras", not general SEO:

| Always on (pure SEO) | Gated by `llmDiscoveryEnabled` |
|---|---|
| Server metadata (title/desc/OG/canonical) | `/llms.txt` (404 when off) |
| All server JSON-LD | AI-bot stanzas in `robots.txt` |
| Sitemap | (training-bot lines disappear, search-bot lines disappear) |
| `.md` twins + `rel=alternate` | |

**Why:** Gating per-page metadata or JSON-LD behind a merchant toggle would silently
hurt SEO for any merchant who disabled the flag. These are always-beneficial, zero-cost
outputs. The "AI discovery extras" (`/llms.txt`, explicit bot stanzas) are the parts
that a merchant might have a business reason to disable (e.g. a brand that wants no AI
exposure), so those are the right things to gate.

The `aiTrainingAllowed` flag is a sub-choice within the gated block — it governs
whether training crawlers (GPTBot, CCBot, Bytespider) are allowed or blocked, but only
applies while `llmDiscoveryEnabled` is on.

---

## Alternatives considered

- **Gate everything behind `llmDiscoveryEnabled`:** Rejected — would silently break SEO
  for merchants who disable the flag without understanding the consequence.
- **Separate `seoEnabled` and `llmEnabled` flags:** Rejected — adds config surface
  without real benefit; SEO is non-optional for a store.
- **UA-based markdown serving at the canonical URL:** Rejected — cloaking risk
  outweighs the marginal convenience.
