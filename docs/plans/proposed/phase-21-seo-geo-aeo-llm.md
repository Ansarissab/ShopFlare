# Plan 21 — SEO / GEO / AEO + LLM-Readable Pages (roadmap #7 + #4)

> **For the implementer (Sonnet):** Execute end-to-end. Follow CLAUDE.md DRY rules.
> UI strings live in `src/lib/i18n/en.ts` (never hardcode in JSX). Constants in
> `src/lib/constants/index.ts`. Never edit build/output folders (`.next/`,
> `.open-next/`). No raw `fetch()` in app code — use `src/lib/api.ts`. Do **not**
> `git push` or open a PR. Small focused commits per §9.
>
> **DEPENDS ON PHASE 17** (`docs/plans/proposed/phase-17-foundations.md`). Phase 17
> ships the SSR refactor + the SEO/markdown scaffolds this plan fills in. **Do not
> redefine** them — extend. If Phase 17 is not yet merged when this starts, land it
> first. Phase 21 is the "fill in + finish + policy" layer on top.

---

## 1. Goal

Make every public Store page maximally legible to (a) classic search engines, (b)
**GEO/AEO** answer engines (Google AI Overviews, ChatGPT-Search, Perplexity, Claude),
and (c) LLMs that fetch pages directly — **without paying for any SaaS** and at **$0
hosting**. Two roadmap items collapse into one phase because they share plumbing:

- **#7 SEO/GEO/AEO** — server-rendered metadata + JSON-LD on every page, FAQ Q&A,
  front-loaded answers, canonicals, sitemap polish.
- **#4 LLM-readable pages (toggleable)** — dynamic `/llms.txt`, Markdown twins of
  public pages via content negotiation, and an AI-bot policy in `robots.txt`.

### Research rationale (June 2026 — state as locked decisions)
- **Highest ROI = server-rendered JSON-LD.** Client-injected `<script type=ld+json>`
  is unreliable (crawlers + answer engines often render the *initial* HTML only). All
  structured data MUST be in the server HTML response. Emit Product + Offer +
  AggregateRating + Organization + BreadcrumbList; **FAQPage where real Q&A exists**.
- **Keep FAQPage even though Google dropped the FAQ *rich-result display* (May 2026).**
  The schema still feeds AI citation/answer-engine extraction. Cost is near zero.
- **GEO/AEO tactics:** answer the page's core question in the first ~200 words, plainly;
  add FAQ/Q&A blocks; keep entity data consistent (same name/URL/logo everywhere); date
  content; and still rank in classic organic (AEO rides on SEO, it does not replace it).
- **LLM discovery (all gated by `llmDiscoveryEnabled`, default TRUE):**
  1. dynamic `/llms.txt` built from D1 (store summary + curated links);
  2. Markdown twins via **content negotiation** (`Accept: text/markdown`) **and** a
     `.md` suffix, advertised with `<link rel="alternate" type="text/markdown">` +
     `Link:` header — **no user-agent sniffing** (UA-based content swaps = cloaking,
     penalized);
  3. `robots.txt` AI-bot policy that **distinguishes SEARCH bots from TRAINING bots**,
     with an admin "allow AI training?" choice, optional `Content-Signal` line.
- **CRITICAL audit:** Cloudflare's dashboard "Block AI Scrapers & Crawlers" managed
  toggle + WAF Bot Fight Mode can silently 403 the very UAs we allow above. Document a
  manual verification step (§6).

---

## 2. Current state (refs — verified)

- **Root metadata only.** `src/app/layout.tsx:13` `generateMetadata()` fetches
  `/api/config/store` (5 min cache), sets title template / OG / Twitter, fails graceful.
  **Per-page metadata is missing** (pages were client-rendered pre-Phase-17).
- **JSON-LD is CLIENT-side today** — must be removed in favor of server emission:
  - `src/components/store/product/ProductJsonLd.tsx` (`'use client'`, Product + Offer/
    AggregateOffer + optional AggregateRating; fetches config + reviews in `useEffect`).
  - `CategoryJsonLd` inline in `src/app/(store)/category/[slug]/page.tsx`
    (BreadcrumbList + CollectionPage).
- **Sitemap:** `src/app/sitemap.ts` (dynamic, 1 h revalidate: home + products +
  categories + policies; reads `NEXT_PUBLIC_WORKER_URL` / `NEXT_PUBLIC_SITE_URL`).
- **Robots:** `src/app/robots.ts` (`*` allow `/`, disallow `/admin/` `/api/`, sitemap
  ref) **plus** a stale static `public/robots.txt` (allows GPTBot/ClaudeBot, crawl-delay,
  blocks Ahrefs/Semrush/MJ12/DotBot). Two robots sources is a conflict — resolve in §5.
- **i18n:** single `src/lib/i18n/en.ts`. **No** markdown lib, **no** `llms.txt`.
- **Config storage:** `store_config` is a **key/value** table
  (`worker/db/schema.ts:168`, `{key, value, updatedAt}`). Feature flags + FAQ live as
  rows here (e.g. existing `taxEnabled` row read in `worker/routes/config.ts:73`). Policy
  page bodies live in the `pages` table (`worker/db/schema.ts:185`, Trix HTML).
- **Worker entry:** `worker/index.ts` (Hono) mounts `/api/*` + `/cdn/*`. Either the
  Worker or a Next route handler can serve `/llms.txt` + `.md` — decided in §5.
- **CONTEXT.md** already defines **LLM Discovery** (line 114) and **Feature Flag**
  (line 94). Verify wording still matches what ships; do not duplicate the term.

### Phase 17 artifacts this plan USES (do not redefine)
- `src/lib/seo/jsonld.ts` — `productJsonLd`, `offerJsonLd`, `aggregateRatingJsonLd`,
  `organizationJsonLd`, `breadcrumbListJsonLd`, `faqPageJsonLd`, `articleJsonLd`.
- `src/lib/seo/metadata.ts` — `buildPageMetadata(...)`.
- server `<JsonLd>` component (renders an escaped `ld+json` script in SSR HTML).
- `worker/lib/markdown.ts` — content-negotiation responder scaffold.
- `isFeatureEnabled(...)` helper + `llmDiscoveryEnabled` flag (default TRUE).
- product / category / policy pages already converted to async Server Components with
  `generateMetadata` stubs.

---

## 3. SEO deliverables (server-rendered)

### 3.1 Per-page `generateMetadata` (product / category / policy / home)
Fill the Phase-17 stubs. Each calls `buildPageMetadata(...)` so title/description/
canonical/OG/Twitter are built **once** in one place (DRY — never hand-roll a `Metadata`
object per page).

| Route file | Title source | Description source | Canonical |
|---|---|---|---|
| `src/app/(store)/page.tsx` (home) | store name + tagline | tagline / store summary | `/` |
| `src/app/(store)/product/[slug]/page.tsx` | product name | product description (front-loaded, ~155 char clamp) | `/product/{slug}` |
| `src/app/(store)/category/[slug]/page.tsx` | category name | category description / generated | `/category/{slug}` |
| `src/app/(store)/policy/[slug]/page.tsx` | page title | first ~155 chars of page body, HTML-stripped | `/policy/{slug}` |

- `buildPageMetadata` takes `{ title, description, path, image?, type? }` and resolves
  the absolute base from `NEXT_PUBLIC_SITE_URL` (fallback derived from
  `NEXT_PUBLIC_WORKER_URL`, mirroring `sitemap.ts:7-9`). Sets `alternates.canonical`.
- OG image: product → first image; else store `logoUrl`. Reuse the layout fallbacks.
- 404/`notFound()` products/categories must NOT emit a canonical (let Next 404).

### 3.2 Server JSON-LD on each page (remove the client versions)
Emit via the server `<JsonLd>` component using `src/lib/seo/jsonld.ts` builders:
- **Product page:** `productJsonLd` (name, description, images, brand=store) + `offerJsonLd`
  / AggregateOffer (currency from store config, availability from stock) +
  `aggregateRatingJsonLd` when review count > 0 + `breadcrumbListJsonLd` (Home → Category →
  Product). Port the price/availability logic out of `ProductJsonLd.tsx` into the builder
  (it already exists in Phase 17 — verify parity, do not re-implement).
- **Category page:** `breadcrumbListJsonLd` + CollectionPage (port from the inline
  `CategoryJsonLd`).
- **Policy page:** `breadcrumbListJsonLd` + optional `Article`/`WebPage`.
- **`@id` + entity consistency:** Organization gets a stable `@id` (`{siteUrl}#org`);
  Product/Breadcrumb reference it for brand → one entity graph (AEO signal).

**Then DELETE** `src/components/store/product/ProductJsonLd.tsx` and the inline
`CategoryJsonLd`, and remove their usages. Grep to confirm zero remaining client
`ld+json` emitters. Data the client version fetched (currency, review aggregate) is now
fetched server-side in the page's existing data load — pass into the builders, no extra
round-trips.

### 3.3 Organization JSON-LD sitewide
Render `organizationJsonLd` once from `src/app/layout.tsx` (server) using store name,
`siteUrl`, `logoUrl`, contact email / WhatsApp where present. Single source of truth for
the store entity; product `brand` references the same `@id`.

### 3.4 Canonicals + sitemap polish
- Canonicals come from `buildPageMetadata` (§3.1). Verify trailing-slash + query-param
  stripping so faceted/sorted URLs canonicalize to the clean path.
- `sitemap.ts`: keep current dynamic build; add `lastModified` from
  `product.updatedAt` / `pages.updatedAt` (freshness = AEO signal); leave a TODO marker
  + structure for blog routes (blog is a later phase — do not build it here).

---

## 4. GEO / AEO deliverables

### 4.1 FAQ content source (decision)
`store_config` is key/value and `pages` holds Trix HTML, so **no migration is needed**.
**Recommended minimal model:**
- **Sitewide FAQ** — one Trix-authored field stored as a `store_config` row
  `faqContent` (HTML) + flag row `faqEnabled`. Authored in Admin → Store settings.
- **Optional per-product FAQ** — a nullable `faqContent` Trix field on the product
  (per-product Q&A is the strongest AEO signal for commerce). Site-wide off wins, matching
  the Feature-Flag rule in CONTEXT.md.
- Parse Q&A out of the Trix HTML into `{question, answer}[]` for `faqPageJsonLd`. Use a
  simple, documented convention (e.g. `<h3>`/`<h4>` = question, following block = answer)
  so merchants need no markup knowledge. Render the same Q&A **visibly** on the page (the
  visible HTML and the JSON-LD must match — mismatched FAQ schema is a spam signal).

See §7 for the exact storage keys. Keep it minimal: sitewide first, per-product optional.

### 4.2 Front-loaded answers
- Product/category/policy pages put a plain-language answer in the **first ~200 words**
  of body copy (description renders above the fold, before variant pickers). This is
  content guidance baked into the page layout + admin help text, not new infra.
- Add admin help copy (i18n string) nudging merchants to "answer the buyer's main
  question in the first two sentences." Strings in `en.ts` (e.g. `seo.faqHelp`,
  `seo.descriptionHelp`).

### 4.3 Entity consistency + freshness
- Reuse the single Organization `@id` (§3.3) everywhere.
- Surface a visible "Updated {date}" on policy pages (from `pages.updatedAt`) — dated
  content is an answer-engine trust signal.

---

## 5. LLM deliverables (gated by `llmDiscoveryEnabled`)

**Hosting decision:** serve all three from the **frontend** so they sit on the public
origin alongside the pages (same host as the HTML the bots crawl). Use **Next route
handlers** under `src/app/` (they render in the `shopflare-web` Worker via OpenNext),
fetching D1-backed data through `src/lib/api.ts` against the API worker. This keeps
`worker/lib/markdown.ts` (Phase 17 scaffold) as the **shared formatter** imported by the
route handler — DRY, one markdown serializer.

### 5.1 Dynamic `/llms.txt`
- `src/app/llms.txt/route.ts` (or `src/app/[[...]]` style handler) → `GET` returns
  `text/plain` (`Content-Type: text/plain; charset=utf-8`).
- Built from D1: `# {Store Name}` H1, one-line summary (tagline / store description),
  then sectioned link lists per the llms.txt convention:
  `## Products`, `## Categories`, `## Policies` (+ `## Blog` later), each line
  `- [Title]({absUrl}): short desc`. Cache ~1 h (revalidate), fail graceful to a minimal
  store-summary file.
- **Gated:** when `llmDiscoveryEnabled` is false → return `404`.

### 5.2 Markdown twins (content negotiation + `.md` suffix)
- **Negotiation:** when a request for a public page carries `Accept: text/markdown`,
  return the markdown rendering instead of HTML. Implement at the page level (server
  component branch) or via middleware that rewrites to the `.md` handler — choose
  whichever Phase-17's `markdown.ts` scaffold already assumes; **document the choice**.
- **`.md` suffix:** `src/app/(store)/product/[slug].md/route.ts` and equivalents (or a
  single catch-all `.md` handler) return the same markdown. Markdown body = title +
  front-loaded description + key facts (price/availability/variants for products; Q&A;
  policy text) — produced by **one** `worker/lib/markdown.ts` serializer (no duplication
  per page type).
- **Advertise (no UA sniffing):**
  - In page `<head>`: `<link rel="alternate" type="text/markdown" href="{url}.md">`
    (add via `buildPageMetadata` `alternates.types`).
  - Response header: `Link: <{url}.md>; rel="alternate"; type="text/markdown"`.
  - **Never** branch on `User-Agent` — same URL serves the same content to everyone;
    only the `Accept` header or the explicit `.md` URL changes the format. (Cloaking
    guardrail.)
- **Gating decision (see §8):** `.md` twins stay available even with the flag OFF (they
  are a thin SEO-neutral alternate of public content); only `/llms.txt` and the
  AI-training robots lines are the "explicit discovery extras" that the flag hides.
  → *Confirm with user before locking; default below.*

### 5.3 `robots.txt` AI-bot policy + admin "allow AI training?"
**Resolve the two-source conflict first:** delete the stale static
`public/robots.txt`; make `src/app/robots.ts` (or a `robots.txt` route handler if dynamic
admin state is needed — it is, see below) the single source. A static
`MetadataRoute.Robots` can't read D1, so convert to a **route handler**
`src/app/robots.txt/route.ts` that builds the body dynamically.

Policy:
- **Always allow** classic crawlers (`*` allow `/`, disallow `/admin/` `/api/`) +
  **SEARCH/answer bots** (these power citations buyers see): `OAI-SearchBot`,
  `PerplexityBot`, `Claude-SearchBot`, `ChatGPT-User`, `Claude-User`, `Amazonbot`.
- **TRAINING bots** (`GPTBot`, `Google-Extended`, `Applebot-Extended`, `CCBot`,
  `anthropic-ai`, `Bytespider`) → governed by an admin **`aiTrainingAllowed`**
  `store_config` flag (default: user's choice — recommend **TRUE/allow** for a new store
  wanting visibility; merchant can flip to block).
- Optional **`Content-Signal`** line reflecting the same training choice
  (e.g. `Content-Signal: ai-train=no` when blocked) — emerging standard, low cost.
- Keep the SEO-scraper blocks (Ahrefs/Semrush/MJ12/DotBot) ported from the old static file.
- `Sitemap:` line uses the resolved `siteUrl`.
- **Gated:** when `llmDiscoveryEnabled` is OFF → robots.txt omits the AI-bot stanzas
  entirely and falls back to the plain `* / admin /api` policy (so the flag genuinely
  controls AI exposure).

Constants: AI-bot user-agent lists → `src/lib/constants/index.ts`
(`AI_SEARCH_BOTS`, `AI_TRAINING_BOTS`, `BLOCKED_SCRAPER_BOTS`). Never inline.

---

## 6. Cloudflare "Block AI Scrapers" audit (manual + documented)

Even a perfect `robots.txt` is moot if Cloudflare's edge 403s the UAs first. **This is a
manual verification step** — it cannot be automated from the repo.

- In the CF dashboard for both zones/Workers: check **Security → Bots → "Block AI
  Scrapers & Crawlers"** managed toggle and **Bot Fight Mode** / WAF managed rules. If
  ON, they will block `GPTBot`, `Bytespider`, etc. — and can catch search/answer bots
  too. Decide per the merchant's `aiTrainingAllowed` choice:
  - want AI visibility → ensure the managed AI-scraper block is **OFF** (or scoped to
    exclude the search/answer UAs we allow).
- **Verify after deploy** with `curl -A "OAI-SearchBot" https://{site}/` and
  `curl -A "PerplexityBot" https://{site}/llms.txt` → expect `200`, not `403`/challenge.
  Add these as a documented post-deploy checklist (not a CI test — needs prod edge).
- Document in `docs/setup/cloudflare-guide.md` (§12).

---

## 7. Schema / DB (FAQ storage — minimal, no migration where avoidable)

`store_config` (key/value) absorbs the sitewide rows — **no schema migration**:
- `faqEnabled` = `'true'|'false'`
- `faqContent` = Trix HTML (sitewide Q&A)
- `aiTrainingAllowed` = `'true'|'false'` (default per user decision)
- (`llmDiscoveryEnabled` already exists per Phase 17.)

Surface them in `worker/routes/config.ts` read map (alongside `taxEnabled` at line 73)
and in the admin config write path. **Per-product FAQ** is the only schema add: nullable
`faqContent text` column on `products` in `worker/db/schema.ts` + a Drizzle migration. If
the user prefers zero migration for v1, ship **sitewide-only** and defer per-product. →
Recommend sitewide-first; per-product behind the same `faqEnabled` flag in a follow-up.

Types: infer from Drizzle / extend the existing `StoreConfig` type
(`worker/db/schema.ts:246`) — no hand-declared shapes. Validation: extend the existing
store-config Zod schema in `src/lib/schemas/` with the new keys (`.extend()`), never inline.

---

## 8. Toggling (`llmDiscoveryEnabled`) — what the flag controls

Locked split (the SEO-vs-discovery line):
- **ALWAYS ON (pure SEO, never gated):** per-page metadata, canonicals, all server
  JSON-LD (Product/Offer/Rating/Org/Breadcrumb/FAQPage), sitemap, classic robots policy,
  `.md` twins + their `rel=alternate` advertisement. These help ranking and cost nothing
  to leave on; gating them would only hurt SEO.
- **GATED by `llmDiscoveryEnabled` (the "AI discovery extras"):** `/llms.txt` (404 when
  off) and the **AI-bot stanzas** in robots.txt (search + training lines disappear; falls
  back to plain policy). The `aiTrainingAllowed` flag is a sub-choice that only matters
  while discovery is ON.
- Enforcement is **server-side** (route returns 404 / omits lines), never just hidden in
  the admin UI — matches the Feature-Flag definition in CONTEXT.md.

> **Open question for user:** confirm `.md` twins stay ungated (recommended) vs. fully
> under `llmDiscoveryEnabled`. Default above = `.md` ungated.

---

## 9. Rollout (small, focused commits — one logical change each)

1. `feat(seo): per-page generateMetadata via buildPageMetadata (product/category/policy/home)` + canonicals.
2. `feat(seo): server Organization JSON-LD sitewide in layout`.
3. `feat(seo): server JSON-LD on product page (Product+Offer+Rating+Breadcrumb)`.
4. `feat(seo): server JSON-LD on category + policy pages`.
5. `refactor(seo): remove client ProductJsonLd + inline CategoryJsonLd; verify zero client ld+json`.
6. `feat(config): faqEnabled/faqContent/aiTrainingAllowed store_config keys + schema/Zod`.
7. `feat(aeo): sitewide FAQ render + faqPageJsonLd; admin Trix editor + i18n help`.
8. `feat(llm): dynamic /llms.txt route from D1, gated by llmDiscoveryEnabled`.
9. `feat(llm): markdown twins (.md suffix + Accept negotiation) via worker/lib/markdown serializer + rel=alternate/Link header`.
10. `feat(seo): dynamic robots.txt route — AI search/training bot policy + Content-Signal; delete stale public/robots.txt`.
11. `feat(seo): sitemap lastModified + blog TODO scaffold`.
12. `test(seo): server-HTML assertions for metadata/JSON-LD/llms.txt/.md/robots`.
13. `docs(seo): seo-llm feature doc + cloudflare-guide AI-scraper audit + CONTEXT verify + README`.
14. `chore(plan): git mv phase-21 proposed → done` (last, after self-audit + `pnpm verify` green).

---

## 10. Acceptance

- **Raw server HTML** (`curl https://{site}/product/{slug}` — no JS) contains a per-page
  `<title>`, `<meta name=description>`, OG tags, `<link rel=canonical>`, and a server
  `<script type="application/ld+json">` with `@type: "Product"` + Offer (+ Rating when
  reviews exist) + BreadcrumbList. Same for category (CollectionPage+Breadcrumb), policy,
  and home (Organization). **No** client-injected `ld+json` remains.
- Page `<head>` carries `<link rel="alternate" type="text/markdown" href=".../{path}.md">`
  and the response sets the matching `Link:` header.
- `GET /llms.txt` returns `text/plain`, valid llms.txt structure, real D1 links; returns
  `404` when `llmDiscoveryEnabled` is off.
- `GET /product/{slug}.md` **and** `GET /product/{slug}` with `Accept: text/markdown`
  return identical markdown; default `Accept` still returns HTML (no UA sniffing anywhere).
- `GET /robots.txt` reflects: classic policy + (when discovery on) search-bot allows +
  training-bot lines honoring `aiTrainingAllowed` + optional `Content-Signal`; AI stanzas
  vanish when discovery off. Single source (no leftover `public/robots.txt`).
- **Automated tests** assert metadata + JSON-LD presence in the **server response** (not
  the hydrated DOM) — unit/integration layer per the project's test pyramid; FAQ JSON-LD
  matches the visible Q&A. (Worker-served bits behaviorally covered in the integration
  suite per the coverage ADR.)
- Manual: a structured-data validator (validator.schema.org / Rich Results Test) passes
  for product/category/home; Lighthouse SEO ≈ 100. Note results in the feature doc.
- `pnpm verify` green.

---

## 11. Non-goals

- No paid SEO tools (Ahrefs/Semrush/Screaming Frog/Clearscope) — `$0` only.
- No external GEO/AEO submission or "AI SEO" services; no Bing/IndexNow push (later).
- No multi-language / hreflang (single locale `en` for now).
- No blog implementation here — only sitemap/llms.txt scaffolding hooks for later.
- No new analytics for AI traffic (a separate phase could parse bot UAs from logs).
- No per-product FAQ if the user chooses sitewide-only for v1 (deferred, not redesigned).

---

## 12. Docs to update

- **Verify** CONTEXT.md "LLM Discovery" (line 114) + "Feature Flag" (line 94) still match
  what ships; tweak wording only if drifted (do not duplicate).
- **New** `docs/features/seo-llm.md` — what's emitted, the flag matrix (§8), FAQ authoring
  convention, the no-UA-sniffing rule, validator results.
- `docs/architecture/overview.md` — add the SEO/LLM surface (route handlers + shared
  markdown serializer + jsonld/metadata libs).
- `docs/setup/cloudflare-guide.md` — add the **"Block AI Scrapers" audit** step (§6) with
  the `curl -A` verification commands and the `aiTrainingAllowed` linkage.
- `README.md` — one line under features: SEO + GEO/AEO + toggleable LLM discovery.
- Consider a short ADR (`docs/adr/`) recording the server-JSON-LD + no-cloaking +
  flag-split decisions if the team logs decisions there.
- Last commit: `git mv docs/plans/proposed/phase-21-seo-geo-aeo-llm.md docs/plans/done/`.

---

## 13. Self-audit checklist (tick before `git mv` to done/)

- [ ] Every public page (product/category/policy/home) has **server** metadata
      (title/desc/OG/Twitter/canonical) via `buildPageMetadata`.
- [ ] Every public page emits **server** JSON-LD (Product/Offer/Rating, CollectionPage,
      Breadcrumb, Organization sitewide, FAQPage where Q&A exists).
- [ ] Client `ProductJsonLd` + inline `CategoryJsonLd` deleted; `grep` finds **zero**
      client-side `ld+json` emitters.
- [ ] `/llms.txt` valid, dynamic from D1, 404s when `llmDiscoveryEnabled` off.
- [ ] `.md` negotiation works via `Accept` **and** `.md` suffix; **no** User-Agent
      branching anywhere; `rel=alternate` + `Link` header present.
- [ ] `robots.txt` is single-source (stale `public/robots.txt` removed), reflects the
      search/training split + `aiTrainingAllowed` + optional Content-Signal, gated by flag.
- [ ] CF "Block AI Scrapers" + Bot Fight audited and documented; `curl -A` checks pass.
- [ ] Flag split honored: SEO always on; `/llms.txt` + AI robots stanzas gated.
- [ ] AI-bot UA lists + FAQ keys live in `constants`/`store_config`, not inlined; strings
      in `en.ts`; types inferred from Drizzle; Zod extended not inlined (DRY pass).
- [ ] Tests added at the right layer assert metadata + JSON-LD in the **server response**.
- [ ] `pnpm verify` green.
- [ ] This plan re-read end-to-end; open questions in §5.2/§8 resolved with the user.
