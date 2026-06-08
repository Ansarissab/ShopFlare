# Plan 22 — Storytelling Landing Page + Style Presets ("Shopify-like themes" v1)

> Roadmap item #3. Depends on **Phase 17 foundations** (feature flags, `RenderHtml`,
> `RichText`, shared `ImageUpload`, SSR + `buildPageMetadata`/`JsonLd`) and reads better
> after **Phase 18** (image-confirm UX) and **Phase 21** (SEO/JSON-LD). Do NOT redefine
> anything those phases own — reuse it.

## 1. Goal

Two merchant-facing wins, both **no-redeploy** (Dynamic-First):

1. A toggleable **storytelling Landing Page** at `/`. When `landingEnabled` is ON, `/`
   renders a fixed, ordered set of merchant-editable sections (Hero, Story, Featured
   Products, Reviews strip, CTA band) and the product catalog moves to `/shop`. When OFF,
   `/` is the product grid exactly as today and `/shop` does not exist.
2. **Style Presets** — ~4–6 named "looks" (Minimal, Bold, Elegant, Playful, …) that bundle
   colors + font + radius + density + hero style and apply in one click through the
   **existing CSS-variable theme engine**. No alternate component trees, no new layout
   templates (that's V2 — see §10).

Hard constraints: DRY (reuse Phase 17 building blocks, don't reimplement), all strings in
`src/lib/i18n/en.ts`, all constants in `src/lib/constants/index.ts`, Zod bases in
`src/lib/schemas/`, network via `src/lib/api.ts`, colors via CSS vars only (no hex in
components).

## 2. Current state (refs)

- **Home `/`** — [`src/app/(store)/page.tsx`](../../../src/app/(store)/page.tsx): a
  **client** component (`'use client'`) that fetches `/api/products` and renders the grid,
  the single-product hero (when exactly 1 product, `page.tsx:112`), search + category
  filter. This is the page the toggle gates.
- **Theme engine** — pre-hydration boot script
  [`src/app/layout.tsx:43-63`](../../../src/app/layout.tsx) sets `--store-primary`/`-fg`,
  `--store-accent`/`-fg`, `--radius`, `--store-font` from the `shopflare-theme`
  localStorage snapshot; [`ThemeProvider`](../../../src/components/store/ThemeProvider.tsx)
  fetches `/api/config/store` and calls `applyTheme()`;
  [`src/lib/theme.ts`](../../../src/lib/theme.ts) `applyTheme()`;
  [`globals.css:40-85`](../../../src/app/globals.css) light/dark vars
  (`--primary: var(--store-primary, …)` etc.).
- **Theme constants** —
  [`src/lib/constants/index.ts:91-96`](../../../src/lib/constants/index.ts) `THEME_PRESETS`
  (4 color-only presets), `RADIUS_PRESETS:70-77`, `FONT_PRESETS:80-86`, `COLOR_MODES:88`.
- **Appearance schema** —
  [`src/lib/schemas/config.ts:15-28`](../../../src/lib/schemas/config.ts)
  `appearanceSchema`, merged into `storeConfigSchema:40-58`.
- **Admin appearance editor** —
  [`src/app/(admin)/admin/settings/page.tsx:204-397`](../../../src/app/(admin)/admin/settings/page.tsx)
  (preset chips already iterate `THEME_PRESETS`).
- **Config storage** — `store_config` is a **string key/value** table
  [`worker/db/schema.ts:168-172`](../../../worker/db/schema.ts). `GET /api/config/store`
  assembles a typed object from rows
  [`worker/routes/config.ts:17-91`](../../../worker/routes/config.ts); admin `PUT /store`
  upserts each key as `String(value)`
  [`worker/routes/admin/config.ts:21-45`](../../../worker/routes/admin/config.ts) then
  `bumpDataVersion()`.
- **Phase 17 deps (build them there, reuse here)** — `isFeatureEnabled(config, key)` +
  `FEATURE_FLAGS.landingEnabled` (default `false`),
  [`RenderHtml`](../../../src/components/shared/RenderHtml.tsx) + `sanitizeHtml`
  ([`src/lib/html.ts`](../../../src/lib/html.ts)),
  [`RichText`](../../../src/components/shared/RichText.tsx) Trix wrapper, shared
  [`ImageUpload`](../../../src/components/shared/ImageUpload.tsx) (compress + confirm).
  See [`phase-17-foundations.md`](./phase-17-foundations.md).
- **Phase 21 deps** — `buildPageMetadata` ([`src/lib/seo/metadata.ts`](../../../src/lib/seo/metadata.ts)),
  `organizationJsonLd`/`breadcrumbListJsonLd` ([`src/lib/seo/jsonld.ts`](../../../src/lib/seo/jsonld.ts)),
  server `<JsonLd>`. See [`phase-21-seo-geo-aeo-llm.md`](./phase-21-seo-geo-aeo-llm.md).
- **Reviews** — [`ReviewsSection`](../../../src/components/store/product/ReviewsSection.tsx)
  (per-product) → adapt to a store-wide approved-reviews strip.
- **Sitemap** — [`src/app/sitemap.ts`](../../../src/app/sitemap.ts) (static `/` + policy +
  product + category routes).
- **PWA tab routes** — [`src/lib/constants/index.ts:120-126`](../../../src/lib/constants/index.ts)
  `TAB_ROUTES` (`home → /`, `shop → /?tab=shop`).

## 3. Schema / DB

### 3.1 Decision: dedicated tables, NOT JSON-in-`store_config`

`store_config` is a flat **string** key/value store (`PUT` writes `String(value)`). Stuffing
five sections + a featured-product list as one JSON blob into a single key works but is a poor
fit: it loses per-section `enabled` flags as first-class columns, makes the featured-product
list (an ordered relation to `products`) awkward, and the admin form would have to
read-modify-write the whole blob on every save (lost-update risk). So:

**`landing_content`** — one row per fixed section (5 rows, seeded by migration). Each row
carries the small set of fields that section actually uses; unused columns stay null.

```
landing_content
  sectionKey   text  PK            -- 'hero' | 'story' | 'featured' | 'reviews' | 'cta'
  enabled      integer(boolean) NOT NULL DEFAULT 1
  heading      text                -- hero headline / story heading / cta heading
  subtext      text                -- hero subtext / cta subtext
  bodyHtml     text                -- story rich-text (sanitized Trix HTML); others null
  ctaText      text                -- hero + cta button label
  ctaHref      text                -- hero + cta button target (internal path or url)
  imageR2Key   text                -- hero + story image (R2 object key, served via existing image route)
  updatedAt    text  NOT NULL DEFAULT (datetime('now'))
```

**`featured_products`** — ordered join from the featured strip to products.

```
featured_products
  productId   text  PK  REFERENCES products(id) ON DELETE CASCADE
  sortOrder   integer NOT NULL DEFAULT 0
```

Both modeled with Drizzle in [`worker/db/schema.ts`](../../../worker/db/schema.ts) (alongside
`storeConfig`); export inferred types and surface composite types in
[`src/lib/types/store.ts`](../../../src/lib/types/store.ts) (never declare `*Props` per file).

The **`landingEnabled` flag itself stays in `store_config`** (it's a Phase-17 feature flag,
read by `isFeatureEnabled`), not in `landing_content`. `landing_content.enabled` is per-section.

### 3.2 Migration

New file under [`worker/db/migrations/`](../../../worker/db/migrations/) (generate via the
project's Drizzle workflow): create both tables; **seed** the 5 `landing_content` rows
(`hero`, `story`, `featured`, `reviews`, `cta`) with `enabled = 1` and empty content so the
admin editor and SSR page have rows to read on day one. Keep `featured_products` empty.

## 4. Deliverables

### 4.1 Landing route — `/` toggles, catalog → `/shop`

- Convert the home route to honor the flag. Cleanest split given the current page is a client
  component:
  - **`src/app/(store)/page.tsx`** → thin **SSR** wrapper that reads config server-side
    (fetch `/api/config/store` via `src/lib/api.ts` server helper). If
    `isFeatureEnabled(config, 'landingEnabled')` → render `<LandingPage config=… />` (SSR,
    with metadata + JSON-LD, §6). Else → render the existing client catalog, unchanged.
  - Move the **current catalog body** into
    **`src/app/(store)/shop/page.tsx`** (a client component, identical behavior to today's
    grid/search/filter/single-hero). Extract the shared markup into
    `src/components/store/Catalog.tsx` so `/shop` and the flag-off `/` render the **same**
    component (DRY — no copy-paste). Flag OFF: `/shop` returns 404 (or redirects to `/`);
    flag ON: `/` is landing, `/shop` is the catalog.
- Page-level metadata/JSON-LD handled in §6.

### 4.2 Landing section components — `src/components/store/landing/`

All composed from existing shared UI / shadcn primitives and CSS-var-driven styles
(`lib/styles.ts` `layout.*` for repeated combos). One file per section + a `<LandingPage>`
orchestrator that renders sections in fixed order, skipping any with `enabled = false`:

- `LandingPage.tsx` — server component; takes assembled landing content + config, maps the
  fixed ordered section list.
- `HeroSection.tsx` — image (R2 key via existing image URL helper) + headline + subtext +
  CTA button. Honors the preset's `heroStyle` (a CSS-var/class switch, §4.4 — not a new tree).
- `StorySection.tsx` — heading + `<RenderHtml html={bodyHtml} />` (sanitized Trix) + image.
- `FeaturedProductsStrip.tsx` — reuses existing `ProductCard`/`ProductGrid` building blocks,
  rendering the ordered `featured_products` list (resolve via `/api/products`).
- `ReviewsStrip.tsx` — store-wide approved reviews; **adapt**
  [`ReviewsSection`](../../../src/components/store/product/ReviewsSection.tsx) (extract the
  shared review-card so we don't fork it). Needs a store-wide approved-reviews source (an
  existing reviews endpoint filtered to approved, or a small `?scope=store` add — pick the
  endpoint that already returns approved reviews; do not add a table).
- `CTABand.tsx` — heading + subtext + CTA button.

No hardcoded hex anywhere; all colors via CSS vars. All visible copy via `en.ts`.

### 4.3 Admin Landing editor

- New section/page in admin (mirror the Appearance section pattern at
  [`settings/page.tsx:204-397`](../../../src/app/(admin)/admin/settings/page.tsx)) — either a
  dedicated `src/app/(admin)/admin/landing/page.tsx` or a "Landing" card in settings. Provides:
  - Per-section **enable** toggles + a site-wide `landingEnabled` switch (the Phase-17 flag).
  - Hero/CTA: text inputs (heading, subtext, ctaText, ctaHref).
  - Story: `<RichText>` editor (Trix) → stored as sanitized HTML; image via `<ImageUpload>`.
  - Hero image via `<ImageUpload>` (reuse — compress + confirm; never reimplement).
  - Featured products: a **multiselect** backed by `/api/products`
    ([`worker/routes/products.ts`](../../../worker/routes/products.ts)) with drag/up-down
    ordering writing `sortOrder`.
- **API**: add admin routes for landing content rather than overloading `PUT /config/store`
  (different tables). Suggest `worker/routes/admin/landing.ts`:
  `GET /` (assembled landing content), `PUT /sections/:key` (upsert one section, validated by
  the per-section Zod schema), `PUT /featured` (replace ordered product-id list). Each write
  calls `bumpDataVersion(db)` so the store ETag busts and clients refetch. Public read:
  `GET /api/landing` in [`worker/routes/config.ts`](../../../worker/routes/config.ts) or a new
  `worker/routes/landing.ts`, assembling rows the same way `GET /store` does. All client calls
  through `src/lib/api.ts` (`apiGet`/`apiPost`/`apiPut`).
- **Schemas** — `src/lib/schemas/landing.ts`: a `landingSectionBaseSchema`
  (heading/subtext/bodyHtml/ctaText/ctaHref/imageR2Key/enabled, all optional), then derive
  per-section shapes via `.pick()`/`.extend()` (Hero/Story/CTA differ in which fields they
  use). Featured list = `z.array(z.string()).max(N)`. Never inline a schema in a route.

### 4.4 Style Presets — extend the existing engine

- **Constants** — promote `THEME_PRESETS`
  ([`constants/index.ts:91-96`](../../../src/lib/constants/index.ts)) from color-only into
  full preset objects, keeping the 4 existing names working and adding 1–2 more (target 4–6):
  ```ts
  export const STYLE_PRESETS = [
    { name: 'Minimal', primaryColor, accentColor, fontFamily: 'sans',
      radius: 'sm', density: 'comfortable', heroStyle: 'image-left' },
    { name: 'Bold',    …, fontFamily: 'sans',    radius: 'none', density: 'compact',  heroStyle: 'full-bleed' },
    { name: 'Elegant', …, fontFamily: 'serif',   radius: 'md',   density: 'comfortable', heroStyle: 'centered' },
    { name: 'Playful', …, fontFamily: 'rounded', radius: 'full', density: 'spacious', heroStyle: 'split' },
    …
  ] as const
  ```
  `fontFamily`/`radius` reuse existing `FONT_PRESETS`/`RADIUS_PRESETS` keys. `density` is a new
  small preset map (`DENSITY_PRESETS`, e.g. `compact/comfortable/spacious` → a spacing scale)
  exposed as a `--density` CSS var; `heroStyle` is an enum applied as a data-attr/class on the
  hero (still one component, just a layout variant via CSS — NOT a separate tree).
- **CSS** — add `--density` to [`globals.css`](../../../src/app/globals.css) `:root` with a
  sane default; have spacing utilities/`layout.*` reference it where density should bite. Add
  hero-style variant rules keyed off the data-attr. No new color literals.
- **Apply path** — `applyTheme()` in [`src/lib/theme.ts`](../../../src/lib/theme.ts) and the
  boot script ([`layout.tsx:43-63`](../../../src/app/layout.tsx)) gain `--density` + (if needed)
  the hero-style attr, alongside the existing vars (keep boot script and `applyTheme` in sync —
  the file already warns about this). A preset click in admin sets ALL underlying appearance
  fields at once (primaryColor, accentColor, fontFamily, radius, density, heroStyle), persists
  via existing `PUT /config/store`, and `applyTheme` re-paints. Schema: extend
  `appearanceSchema` ([`config.ts:15-28`](../../../src/lib/schemas/config.ts)) with
  `density` + `heroStyle` enums (from the new constants), so they ride the existing config
  read/assemble/persist path (no new endpoint).
- **Admin** — replace the color-only preset chips
  ([`settings/page.tsx:204-`](../../../src/app/(admin)/admin/settings/page.tsx)) with full
  Style Preset cards that set every appearance field on click. One click = whole look changes.

### 4.5 Strings — `src/lib/i18n/en.ts`

All new copy (section labels, editor field labels/help, preset names if surfaced, empty/CTA
defaults, `/shop` nav label, breadcrumb labels) added under the existing `store`/`admin`
namespaces. Zero hardcoded UI text in JSX.

## 5. Routing / navigation changes

- **`/` ↔ `/shop`** — §4.1. Flag ON: `/` = landing, `/shop` = catalog. Flag OFF: `/` = catalog,
  `/shop` 404/redirect to `/`.
- **Header logo link** — keep pointing to `/`
  ([`StorefrontHeader.tsx`](../../../src/components/store/StorefrontHeader.tsx) /
  [`AppHeader.tsx`](../../../src/components/store/shell/AppHeader.tsx)); add a "Shop" nav entry
  that resolves to `/shop` when the flag is ON, `/` when OFF (single helper, used everywhere —
  DRY). Audit `CategoryNav` and any `href="/"` that means "the catalog" → point at the shop
  helper, not a literal.
- **Breadcrumbs** — category/product breadcrumbs whose root is "Home/Shop" must point at the
  catalog route (the helper), so they stay correct under both flag states. Coordinate with the
  Phase-21 `breadcrumbListJsonLd`.
- **Sitemap** — [`src/app/sitemap.ts`](../../../src/app/sitemap.ts): when the flag is ON, add a
  `/shop` entry; `/` stays priority 1 (now the landing page). When OFF, unchanged. Read the flag
  from config the same way the page does.
- **PWA `TAB_ROUTES`** — [`constants/index.ts:120-126`](../../../src/lib/constants/index.ts):
  the `shop` tab currently uses `/?tab=shop`; route it through the shop helper so it lands on
  `/shop` when the flag is ON and `/` when OFF. `home` tab stays `/`.

## 6. SEO

- Landing `/` (flag ON): SSR metadata via `buildPageMetadata({ title, description, path: '/' })`
  ([`src/lib/seo/metadata.ts`](../../../src/lib/seo/metadata.ts)) sourcing storeName/tagline +
  hero image; emit **Organization** JSON-LD via `organizationJsonLd` + the server `<JsonLd>`
  component ([`src/lib/seo/jsonld.ts`](../../../src/lib/seo/jsonld.ts)).
- `/shop` gets list-appropriate metadata (reuse whatever the catalog used at `/` before, just
  re-homed). Don't double-emit Organization on both.
- Flag OFF: `/` metadata behavior unchanged from today.

## 7. Rollout (small commits, conventional)

1. `feat(db): landing_content + featured_products tables + seed migration`
2. `feat(schema): landingSectionBaseSchema + per-section derivations (src/lib/schemas/landing.ts)`
3. `feat(worker): GET /api/landing + admin landing routes (sections + featured), bumpDataVersion`
4. `feat(store): Catalog component extracted; /shop route; SSR / toggles landing vs catalog`
5. `feat(store): landing section components (Hero/Story/Featured/Reviews/CTA) + LandingPage`
6. `feat(admin): landing editor (RichText/ImageUpload/featured multiselect, per-section enable)`
7. `feat(theme): STYLE_PRESETS + DENSITY_PRESETS + heroStyle; --density var; applyTheme + boot sync`
8. `feat(admin): Style Preset cards apply all appearance vars in one click`
9. `feat(nav): shop-route helper; header/breadcrumbs/sitemap/TAB_ROUTES flag-aware`
10. `feat(seo): landing metadata + Organization JSON-LD via Phase-21 helpers`
11. `feat(i18n): landing + preset strings in en.ts`
12. `test: route toggle, section render, featured, preset application, sitemap`
13. `docs: CONTEXT/overview/customization/README; git mv plan proposed → done`

## 8. Acceptance

- **Flag OFF** (default): `/` renders the product grid byte-for-byte as today (single-product
  hero still works); `/shop` 404s/redirects; no landing UI anywhere; sitemap unchanged.
- **Flag ON**: `/` renders the landing page (Hero → Story → Featured → Reviews → CTA, in that
  fixed order, skipping disabled sections); `/shop` renders the full catalog (search, filter,
  pagination, single-product hero) identical to the old `/`.
- Merchant edits each section's text and images from admin and sees changes on `/` **without
  redeploy** (config write → `bumpDataVersion` → client refetch).
- Featured strip shows exactly the merchant-picked products, in the chosen order.
- Reviews strip shows only approved reviews, store-wide.
- One click on a Style Preset changes colors + font + radius + density + hero style across the
  whole store, applied purely through CSS vars (verify no FOUC via the boot script).
- Tests green: route-toggle behavior (both states), section rendering (incl. disabled-section
  skip + `RenderHtml` sanitization), featured-product resolution/order, preset application sets
  all vars, flag-aware nav/sitemap. `pnpm verify` passes.

## 9. Non-goals

- No drag-and-drop section reordering and no arbitrary/custom blocks — the section set is fixed
  and ordered (V2, §10).
- No alternate **layout templates** / alternate component trees — presets only retune the
  existing CSS-var engine (V2, §10).
- No multi-language landing content (single locale; strings still go through `en.ts`).
- No new analytics, no new payment surfaces.

## 10. V2 stub

Real alternate **layout templates** (genuinely different page structures per "theme") and a
**block builder** (drag-drop, add/remove/reorder arbitrary sections) are explicitly deferred.
Capture them in `docs/deferred-v2.md` (create the file if absent; the roadmap at
[`docs/plans/proposed/roadmap.md:50`](./roadmap.md) already points the layout-template deferral
here). v1 ships the fixed section set + CSS-var presets only.

## 11. Docs to update

- [`CONTEXT.md`](../../../CONTEXT.md) — **verify** the already-present glossary terms
  (Landing Page `:99`, Featured Product `:102`, Style Preset `:105`, Feature Flag `:94`,
  Rich Text `:109`) match what this plan ships; adjust wording if the `/shop` behavior or
  preset bundle drifted.
- [`docs/architecture/overview.md`](../../../docs/architecture/overview.md) — document the
  `/` ↔ `/shop` routing change and the flag-gated landing page.
- `docs/admin-guide/customization.md` — add "Landing Page" (toggle + per-section editing) and
  "Style Presets" (one-click looks) merchant instructions (create the page if missing).
- [`README.md`](../../../README.md) — mention the storytelling landing page + style presets in
  the feature list.
- `docs/deferred-v2.md` — add the layout-templates + block-builder deferral note (§10).
- After 100% done + self-audit: `git mv docs/plans/proposed/phase-22-landing-style-presets.md
  docs/plans/done/` and commit (`docs:` per Plan Lifecycle).

## 12. Self-audit checklist

- [ ] Migration creates `landing_content` + `featured_products` and **seeds** the 5 section rows.
- [ ] Route toggle verified **both** ways: flag OFF → `/` grid unchanged + `/shop` absent; flag
      ON → `/` landing + `/shop` catalog.
- [ ] All 5 sections (Hero, Story, Featured, Reviews, CTA) are editable in admin AND render on
      `/`, with per-section enable honored (disabled sections skipped).
- [ ] Featured-product multiselect picks + orders products; strip renders them in `sortOrder`.
- [ ] Style Presets apply colors + font + radius + density + hero style purely via CSS vars;
      **no hardcoded hex** in any landing/preset component; `--density` added to `globals.css`.
- [ ] `RichText` (Story body) and `ImageUpload` (Hero/Story images) are **reused** from Phase 17,
      not reimplemented; Story renders through `RenderHtml`/`sanitizeHtml`.
- [ ] Every new UI string lives in `src/lib/i18n/en.ts`; none hardcoded in JSX.
- [ ] Sitemap, header logo/Shop link, breadcrumbs, and PWA `TAB_ROUTES` are flag-aware via the
      single shop-route helper (no literal `/` meaning "catalog" left behind).
- [ ] Schemas derive from a `landingSectionBaseSchema` (extend/pick), none inlined in routes;
      `appearanceSchema` extended for `density`/`heroStyle`; all network via `src/lib/api.ts`.
- [ ] Tests added for route behavior, section render/sanitization, featured resolution, preset
      application, flag-aware nav/sitemap.
- [ ] `pnpm verify` green (typecheck → lint → unit+coverage → integration → build).
- [ ] Plan re-read end-to-end before marking done; docs in §11 updated; plan `git mv`'d to `done/`.
