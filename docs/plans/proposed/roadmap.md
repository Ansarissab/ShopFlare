# ShopFlare — Phases 17–26 Roadmap (V1 continuation)

Status: **proposed**. This continues the V1 plan series (`docs/plans/done/phase-0` … `phase-16`).
Each phase has its own comprehensive plan file in this folder and is built in a separate session,
behind tests + `pnpm verify`, then `git mv`-ed to `docs/plans/done/`.

Constraint: **$0 hosting** (Cloudflare Workers free plan). **DRY is mandatory** — every cross-cutting
piece is coded ONCE in `lib/`/`worker/lib` and reused (see Shared Resources). Build/output folders
(`.next`, `.open-next`, `coverage`, `*cov*`, `playwright-report`, `test-results`, `graphify-out`,
`node_modules`) are out of scope and never edited.

Decisions were locked in a grill-with-docs session. New glossary terms are in `CONTEXT.md`.
Architecturally significant calls: `docs/adr/0011-server-rendered-metadata.md`,
`docs/adr/0012-trix-html-content.md`.

---

## Origin: the 12 asks → phases

| Ask | What it really is (verified in code) | Phase |
|-----|--------------------------------------|-------|
| 1. WhatsApp optional + admin toggle | Built (per-product button, POS). Missing: floating widget + on/off flag. | 19 |
| 2. Status / uptime page | Only `/api/ping` exists. | 25 |
| 3. Toggleable landing + Shopify-like themes | `/` is product grid; theme = colors/font/radius. | 22 |
| 4. LLM-readable pages, toggleable | None today. | 21 |
| 5. Reviews optional, site + per-product | Fully built; **no toggle**. | 20 |
| 6. Image compression w/ confirmation | Works (silent, 0.8MB/1200px, 5MB cap). | 18 |
| 7. SEO / GEO / AEO | Root metadata only; JSON-LD client-side. | 21 |
| 8. Blog for SEO | None; no markdown lib. | 23 |
| 9. Blog image storage research | **Settled: R2** (base64/D1 premise is false). | 23 |
| 10. Frictionless Cloudflare setup | Wizard ~80%; hardcoded IDs, manual Stripe webhook. | 26 |
| 11. Stripe + bank transfer E2E | Both wired; webhook handler untested. | 24 |
| 12. GitHub → Cloudflare deploy (disabled) | Not present. | 26 |

---

## Locked decisions (apply across all phases)

- **Feature flags** → reuse key-value `store_config` + `storeConfigSchema` (like `taxEnabled`).
  Per-product review flag = `products.reviewsEnabled` column. No flags table, no JSON blob.
- **Rendering** → public pages (product/category/policy/blog/landing) become Server Components that
  export `generateMetadata()` + render JSON-LD/critical content server-side, with inner `'use client'`
  islands for interactivity. (ADR 0011.)
- **WhatsApp (#1)** → floating widget on every page + admin on/off flag + keep per-product button.
- **Reviews (#5)** → OFF = hide display AND block submit (403), data preserved, **server-enforced**;
  site-wide flag wins over per-product.
- **Landing (#3)** → fixed ordered editable sections (hero, story, featured products, reviews strip, CTA).
  ON: `/` = landing, catalog → `/shop`. OFF: `/` = grid. Toggleable.
- **Themes (#3)** → v1: ~4–6 curated **Style Presets** (colors+font+radius+density+hero) on the existing
  CSS-var engine. Real alternate layout templates = deferred (plan stub in Phase 22).
- **LLM (#4)** → dynamic `llms.txt` + `.md` content-negotiation endpoints + FAQPage JSON-LD +
  robots.txt search/training bot policy + audit Cloudflare "Block AI Scrapers" toggle. Toggleable.
- **Content (Trix)** → blog, policy pages, landing section bodies, product descriptions all use the shared
  Trix editor, stored as **sanitized HTML** (DOMPurify ≥3.2.4, server-side). Trix images → R2 via the
  shared compress+upload path (never base64). (ADR 0012.)
- **Blog images (#9)** → R2 (key+alt in D1), AVIF/WebP; base64 only for tiny inline icons / blur LQIP.
- **Compression (#6)** → visually-lossless (AVIF/WebP ~q80 + max-dimension cap); threshold-gated confirm
  showing before/after size + preview; block upload if still over R2 cap. Fallback: Cloudflare Image
  transformations on R2 (free tier) or worker-side re-encode.
- **Status (#2)** → `/healthz` (probes D1/KV/R2, 200/503) + public `/status` page + Better Stack free monitor.
- **Payments (#11)** → Stripe webhook integration test + manual test-mode E2E run + bank-transfer verify +
  runbook. No rewrite expected.
- **Setup (#10, #12)** → strip hardcoded D1/KV IDs → Wrangler auto-provisioning; automate Stripe webhook
  creation; fix stale Pages/CF-Access docs; README Deploy button (API worker); **committed-but-disabled
  GitHub→CF Actions pipeline** (`workflow_dispatch`-only). CLI stays primary.

---

## Shared Resources (DRY — built in Phase 17, reused everywhere)

Phase 17 pins the exact signatures/paths; later phases reference them and MUST NOT re-implement.

| Resource | Location | Consumers |
|----------|----------|-----------|
| `isFeatureEnabled(config, key)` + flag keys/defaults | `src/lib/features.ts`, `src/lib/constants/index.ts` (+ worker mirror) | 19 20 21 22 23 |
| `<RichText>` (Trix wrapper) | `src/components/shared/RichText.tsx` | 22 23 + policies + product desc |
| `sanitizeHtml(html)` + `<RenderHtml>` | `src/lib/html.ts`, `src/components/shared/RenderHtml.tsx` | every Rich Text render |
| `<ImageUpload>` (compress + threshold confirm + before/after) | `src/components/shared/ImageUpload.tsx` | products, categories, Trix, blog cover, landing |
| `compressImage()` util (visually-lossless, size budget) | `src/lib/image.ts` | `<ImageUpload>` |
| JSON-LD builders (Product/Offer/AggregateRating/Org/Breadcrumb/FAQ/Article) | `src/lib/seo/jsonld.ts` | 21 23 |
| `buildPageMetadata()` (title/desc/OG/canonical) | `src/lib/seo/metadata.ts` | all SSR pages |
| `healthProbe(env)` (D1/KV/R2) | `worker/lib/health.ts` | 25 |
| `.md` content-negotiation responder | `worker/lib/markdown.ts` | 21 |

Rules everywhere: schemas extend existing Zod bases (`.extend`/`.merge`/`.pick`); UI strings → `lib/i18n/en.ts`;
colors → CSS vars; network I/O → `lib/api.ts`; backend order/product assembly → `worker/lib`.

---

## Phase index

| Phase | File | Item(s) | Depends on |
|-------|------|---------|-----------|
| 17 | `phase-17-foundations.md` | shared infra | — |
| 18 | `phase-18-image-compression.md` | #6 | 17 |
| 19 | `phase-19-whatsapp.md` | #1 | 17 |
| 20 | `phase-20-reviews-toggle.md` | #5 | 17 |
| 21 | `phase-21-seo-geo-aeo-llm.md` | #7 #4 | 17 |
| 22 | `phase-22-landing-style-presets.md` | #3 | 17, 18, 21 |
| 23 | `phase-23-blog.md` | #8 #9 | 17, 18, 21 |
| 24 | `phase-24-payments-verification.md` | #11 | — |
| 25 | `phase-25-status-uptime.md` | #2 | — |
| 26 | `phase-26-frictionless-setup.md` | #10 #12 | — |

Recommended build order = phase-number order. 24/25/26 are independent and can slot in anytime.

---

## Global acceptance (every phase)

- `pnpm verify` green (typecheck, lint, unit ≥95% on in-scope, integration, build).
- New optional features ship **off by default** behind their flag; existing behavior unchanged when off.
- DRY: no duplicated logic — reuse the Shared Resources; extend, don't copy.
- Every fixed/added behavior gets a regression test in the correct layer (per phase-16 discipline).
- No secrets read/printed; no edits to build/output folders.
- **Every phase plan ends with two mandatory sections**: a **"Docs to update"** list (CONTEXT.md /
  ADRs / README / affected `docs/**` + `git mv` self to `done/`) and a **"Self-audit checklist"** to
  confirm 100% completion before the phase is closed — so nothing has to be re-requested.
</content>
