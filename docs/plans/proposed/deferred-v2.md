# Deferred to V2 — Backlog

Status: **living backlog**. These items were intentionally **punted** out of the
[Phases 17–26 roadmap](./roadmap.md). Nothing here blocks that roadmap. Each item
records *why* it was deferred, a rough scope sketch, and the phase it relates to.

When an item is scheduled it graduates into a numbered phase (27+) with its own plan
file — it does not stay here.

---

## V2 candidates

### 1. Real alternate layout templates ("Shopify themes")
- **Why deferred:** V1 ships only curated **Style Presets** (colors / font / radius /
  density via CSS vars). True alternate layouts = parallel component trees, each
  separately tested — a large surface that would stall the rest of the roadmap.
- **Scope sketch:** 2–3 genuinely different storefront layouts (different nav,
  product-card grids, PDP structure), selectable from admin. Each layout is its own
  set of components behind a layout flag; all must pass the test gate.
- **Stepping stone:** the V1 preset engine (CSS-var theming) is the foundation —
  layouts layer structural variation on top of it.
- **Relates to:** [Phase 22 — landing + style presets](./phase-22-landing-style-presets.md) (ask #3).

### 2. Landing-page block builder
- **Why deferred:** V1 landing is a **fixed ordered set of sections** (toggleable, but
  not reorderable). A full block builder needs a block schema + editor + renderer —
  out of scope for the toggle work.
- **Scope sketch:** drag-drop add / remove / reorder of arbitrary blocks (hero, text,
  gallery, products, video, FAQ). Needs a persisted block schema in D1, an admin
  editor, and a renderer that maps blocks → components.
- **Relates to:** [Phase 22 — landing + style presets](./phase-22-landing-style-presets.md) (ask #3).

### 3. Review photos
- **Why deferred:** the reviews table already has `photoUrl` / `photoR2Key` columns
  (`worker/db/schema.ts:149-150`) but they are **unwired** — no UI, no routes. Phase 20
  scope is the reviews on/off toggle only.
- **Scope sketch:** let verified purchasers attach a photo via the shared `ImageUpload`
  → R2 path, surface it in admin moderation and on the storefront review list. Reuse
  the existing R2 upload helper — no new pipeline.
- **Relates to:** [Phase 20 — reviews toggle](./phase-20-reviews-toggle.md) (ask #5).

### 4. WhatsApp Business / Cloud API
- **Why deferred:** V1 is **`wa.me` deep links only** ($0, no approval). The Cloud API
  carries per-message cost and a Meta approval/template process — breaks the $0 promise
  and adds external dependencies.
- **Scope sketch:** optional WhatsApp Business Cloud API integration for inbound
  messaging, automation, and templated order-status updates. Strictly opt-in, gated so
  the default install stays $0.
- **Relates to:** [Phase 19 — WhatsApp](./phase-19-whatsapp.md) (ask #1).

### 5. Multi-language i18n
- **Why deferred:** today there is a single `src/lib/i18n/en.ts` consumed by direct
  import — no i18n framework. Adding locales is cross-cutting and touches every string
  consumer; not tied to any one phase.
- **Scope sketch:** a lightweight i18n layer over the existing `en.ts` pattern, multiple
  locale files, a locale switch in the storefront, and `hreflang` tags for SEO. Keep the
  "all strings in one place" DRY rule per locale.
- **Relates to:** cross-cutting (SEO overlap with [Phase 21](./phase-21-seo-geo-aeo-llm.md)).

### 6. Blog enhancements
- **Why deferred:** Phase 23 ships the core blog (posts, R2 images, tags). Richer
  features are additive and not needed for the SEO goal that justifies the blog.
- **Scope sketch:** comments, an authors + categories taxonomy beyond tags, scheduled
  publishing, and related-posts. Each is independently shippable.
- **Relates to:** Phase 23 — blog (asks #8 / #9).

### 7. Markdown (`.md`) endpoint coverage — expand
- **Why deferred / status:** Phase 21 **already** includes `.md` twins via content
  negotiation (`Accept: text/markdown`) plus a `.md` suffix for core public pages, built
  on one `worker/lib/markdown.ts` serializer. V2 is about **expanding coverage**, not
  introducing the capability.
- **Scope sketch:** extend `.md` content negotiation to **all** page types (blog posts,
  policy pages, category pages) and add a full `llms-full.txt` that inlines content
  rather than just linking. Reuse the single existing serializer — no second formatter.
- **Relates to:** [Phase 21 — SEO/GEO/AEO/LLM](./phase-21-seo-geo-aeo-llm.md) (ask #4).

### 8. Automated CF budget alerts + custom-domain provisioning
- **Why deferred:** Cloudflare offers no clean API surface for these today, so Phase 26
  leaves them as **documented manual steps**.
- **Scope sketch:** automate budget-alert creation and custom-domain attach/verify from
  the setup wizard — revisit once Cloudflare exposes the necessary API.
- **Relates to:** Phase 26 — frictionless setup (asks #10 / #12).

### 9. Hosted / one-click multi-tenant onboarding
- **Why deferred:** Phase 26 keeps the **CLI wizard** as the primary path. A hosted
  onboarding flow requires standing infrastructure, which breaks the $0 promise **for
  the operator** (not the merchant).
- **Scope sketch:** a hosted web onboarding flow that provisions a tenant's CF resources
  and store config. **Tradeoff to weigh:** operator infra cost vs. merchant convenience —
  this is a business-model decision, not just engineering.
- **Relates to:** Phase 26 — frictionless setup (ask #10).

### 10. Cloudflare Image transformations / responsive srcset pipeline
- **Why deferred:** Phase 18 ships **client-side compression only** (browser-image-
  compression, ~0.8MB / 1200px). On-the-fly resizing is a separate concern.
- **Scope sketch:** adopt **Cloudflare Image transformations** on R2-stored originals
  (free up to 5,000 unique transforms/mo) for on-the-fly resizing + responsive `srcset`
  / `sizes`, so storefront and PDP serve right-sized images. Stay within the free tier
  to hold $0.
- **Relates to:** [Phase 18 — image compression](./phase-18-image-compression.md) (ask #6).

---

## Notes

- This is a **living backlog** — append freely as new "not now" decisions surface.
- Items **graduate into numbered phases (27+)** with their own plan files when scheduled;
  once scheduled they leave this doc.
- **Nothing here blocks the 17–26 roadmap.** These are deliberate punts, not gaps.
