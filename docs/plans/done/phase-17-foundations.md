# Plan 17 — Foundations (shared infra for phases 18–23)

Status: proposed · Depends on: nothing · Blocks: 18, 19, 20, 21, 22, 23

## 1. Goal

Build the cross-cutting pieces that later phases reuse, so no feature re-implements flags,
rich-text, image upload, SEO metadata, or server-side rendering. **This phase ships no
user-visible feature** — it adds shared modules + refactors public pages to render
metadata server-side, with existing behavior preserved and all tests green.

This file is the **contract**: signatures, paths, and props defined here are referenced
verbatim by phases 18–23. Do not change a signature without updating the dependents.

DRY mandate (`CLAUDE.md`): each item below is coded ONCE and imported everywhere.
Out of scope: any build/output folder (`.next`, `.open-next`, `coverage`, `*cov*`,
`playwright-report`, `test-results`, `graphify-out`, `node_modules`).

## 2. Deliverables (the shared contract)

### 2.1 Feature flags — `src/lib/features.ts` (+ worker mirror `worker/lib/features.ts`)

Flags live in the existing key-value `store_config` as stringy booleans, exactly like
`taxEnabled` (`src/lib/schemas/config.ts:31`). No new table.

- Add to `src/lib/constants/index.ts`:
  ```ts
  export const FEATURE_FLAGS = {
    whatsappEnabled:      false,  // #19
    reviewsEnabled:       true,   // #20 (on by default — already live today)
    landingEnabled:       false,  // #22
    blogEnabled:          false,  // #23
    llmDiscoveryEnabled:  true,   // #21
  } as const
  export type FeatureFlagKey = keyof typeof FEATURE_FLAGS
  ```
- Add the same keys to `featureFlagsSchema` and `.merge()` it into `storeConfigSchema`
  (`src/lib/schemas/config.ts:58`) as `z.boolean().optional()` (mirrors `taxConfigSchema`).
- `src/lib/features.ts`:
  ```ts
  export function isFeatureEnabled(
    config: Pick<StoreConfigData, FeatureFlagKey> | null | undefined,
    key: FeatureFlagKey,
  ): boolean   // returns config?.[key] ?? FEATURE_FLAGS[key]
  ```
- `worker/lib/features.ts`: same helper reading the worker's assembled config object
  (the worker already builds a typed config in `worker/routes/config.ts:50-80` and admin
  PUT upserts keys in `worker/routes/admin/config.ts`). Server-side enforcement lives here
  so toggles can't be bypassed by a client.
- Defaults must round-trip through `GET /api/config/store` (extend the defaults block at
  `worker/routes/config.ts:50-80`).

### 2.2 Sanitized HTML — `src/lib/html.ts` + `src/components/shared/RenderHtml.tsx`

- Add `isomorphic-dompurify` (works in the OpenNext worker SSR runtime + jsdom tests);
  pin **≥ 3.2.4** (CVE-2025-26791). Confirm bundle builds under the worker limit.
- `sanitizeHtml(dirty: string): string` — allowlist for Trix output (`h1-h3, p, br, strong,
  em, ul/ol/li, a[href rel], blockquote, img[src alt], figure, figcaption, pre, code`),
  force `a` to `rel="nofollow noopener" target="_blank"`, strip scripts/handlers/`<style>`.
- `<RenderHtml html={...} />` — renders `dangerouslySetInnerHTML={{__html: sanitizeHtml(html)}}`
  inside a `.prose` container. Used by policy/blog/landing/product-desc renders. **Always
  sanitize on render (server-side)**, never trust stored HTML (ADR 0012).

### 2.3 Rich-text editor — `src/components/shared/RichText.tsx`

- Wrap `trix` (`https://trix-editor.org`) as a controlled React component:
  `props: { value: string; onChange(html: string): void; uploadEndpoint?: string }`.
- Import Trix CSS once (global). Render `<trix-editor>` + hidden input; sync via the
  `trix-change` event. SSR-safe (client component, lazy/`dynamic` import, no `window` at
  module load).
- **Image attachments → R2, not base64**: intercept `trix-attachment-add`; if the
  attachment has a file, run it through `compressImage()` (2.4) and POST to the shared
  upload endpoint (reuse `/api/admin/products/images/upload` pattern — Phase 18 generalizes
  it), then `attachment.setAttributes({ url, href })`. Block/cancel base64 data-URI
  attachments. Admin-only component (loaded in authoring contexts).

### 2.4 Image pipeline — `src/lib/image.ts` + `src/components/shared/ImageUpload.tsx`

- `src/lib/image.ts`:
  ```ts
  export const COMPRESS_CONFIRM_THRESHOLD_BYTES = 3 * 1024 * 1024  // 3 MB original
  export interface CompressResult { file: File; originalBytes: number; compressedBytes: number }
  export async function compressImage(file: File, opts?): Promise<CompressResult>
  ```
  Visually-lossless: `browser-image-compression` already in deps; target AVIF/WebP,
  `maxWidthOrHeight` ~2000, `maxSizeMB` ~1, `initialQuality` ~0.8, `useWebWorker: true`,
  `fileType: 'image/webp'` (AVIF if supported). Generalizes the duplicated config in
  `ImageUpload.tsx:24` and `CategoryImageUpload.tsx:23` — both refactor to call this.
- `src/components/shared/ImageUpload.tsx` — single component replacing
  `components/admin/products/ImageUpload.tsx` + `categories/CategoryImageUpload.tsx`:
  props `{ endpoint, extraFields?, onUploaded, max?, currentImages? }`. Behavior:
  compress → if `originalBytes > COMPRESS_CONFIRM_THRESHOLD_BYTES` show a confirm dialog
  with before/after size + thumbnail (`[Cancel] [Confirm]`); else silent. Refuse upload if
  `compressedBytes > MAX_IMAGE_BYTES` (`constants:35`) with a clear message. Full UX detail
  is Phase 18 — Phase 17 only lands the component shell + `compressImage()` so Trix can use it.

### 2.5 SEO helpers — `src/lib/seo/jsonld.ts` + `src/lib/seo/metadata.ts`

- `jsonld.ts` — pure builders returning plain objects (so a server component can
  `JSON.stringify` into a `<script type="application/ld+json">`):
  `productJsonLd`, `offerJsonLd`, `aggregateRatingJsonLd`, `organizationJsonLd`,
  `breadcrumbListJsonLd`, `faqPageJsonLd`, `articleJsonLd`. Port the logic currently in
  client `ProductJsonLd.tsx` / `CategoryJsonLd` into these pure functions (single source).
- `metadata.ts` — `buildPageMetadata(input): Metadata` producing title/description/canonical/
  OpenGraph/Twitter, consistent with the root `generateMetadata` (`src/app/layout.tsx:13`).
  Reads store name/logo from config.
- A small `<JsonLd data={...} />` server component that emits the script tag.

### 2.6 SSR refactor of public pages (ADR 0011)

Convert these from `'use client'` to **async Server Components** that fetch their entity
server-side from the API worker (`NEXT_PUBLIC_WORKER_URL`, same pattern as
`src/app/layout.tsx:13` and `src/app/sitemap.ts`) and pass data into the existing client
tree as props (no double fetch):

- `src/app/(store)/product/[slug]/page.tsx` — server shell: fetch product, `generateMetadata`,
  render `<JsonLd data={productJsonLd(...)} />` + breadcrumb server-side, then
  `<ProductHeroWrapper item={item} />` (already client) + `<ReviewsSection .../>` (client).
  Delete client `ProductJsonLd.tsx` (replaced by server JsonLd).
- `src/app/(store)/category/[slug]/page.tsx` — same shape; server breadcrumb + collection
  JSON-LD; client grid island.
- `src/app/(store)/policy/[slug]/page.tsx` — server fetch page, `generateMetadata`, render via
  `<RenderHtml>` (content becomes HTML in Phase 22 migration; until then wrap plain text).
- Provide a tiny server fetch helper `src/lib/server/fetchFromWorker.ts` (typed GET with
  `next: { revalidate }`), reused by all server pages + `generateMetadata`.

Interactivity (cart, variant/size, forms, search) stays in the inner `'use client'`
islands unchanged. `useApiResource` is no longer needed for the initial entity but may stay
for client refresh.

## 3. Schema / DB

- No migration in Phase 17. Flags are config keys (strings). `products.reviewsEnabled`
  column is added in Phase 20; `blog_posts` + landing tables in their phases.

## 4. Dependencies to add

- `isomorphic-dompurify` (≥3.2.4), `trix`. (`browser-image-compression` already present.)
- Verify worker SSR bundle stays under the 3 MiB free limit after DOMPurify (ADR 0009).

## 5. Rollout (small commits)

1. `feat(config): add feature-flag keys + schema + isFeatureEnabled (client+worker)`
2. `feat(lib): sanitizeHtml + RenderHtml (DOMPurify ≥3.2.4)`
3. `feat(lib): compressImage util + shared ImageUpload shell; refactor product/category uploads onto it`
4. `feat(shared): RichText (Trix) wrapper with R2 attachment upload`
5. `feat(seo): jsonld builders + buildPageMetadata + JsonLd/server fetch helper`
6. `refactor(store): product page → server component w/ generateMetadata + server JSON-LD`
7. `refactor(store): category page → server component`
8. `refactor(store): policy page → server component + RenderHtml`

## 6. Acceptance

- `pnpm verify` green; unit coverage ≥95% on new pure modules (`features`, `html`, `image`,
  `seo/*`). Server pages excluded per `src/app/**` coverage exclusion (ADR 0008) but covered
  by E2E smoke + a new metadata assertion.
- View-source on `/product/[slug]` and `/category/[slug]` shows `<title>`, description, OG
  tags, and JSON-LD **in the initial HTML** (not injected post-hydration). Add a Playwright/
  integration check asserting JSON-LD present in raw response.
- No duplicated compression config or JSON-LD logic remains (old `ProductJsonLd.tsx`,
  per-file upload configs removed/replaced).
- All flags default to today's behavior (reviews on, llm-discovery on, rest off) and
  round-trip through `GET /api/config/store`.

## 7. Non-goals

- No admin toggle UI yet (each feature phase adds its own switch).
- No content migration to HTML (Phase 22 does policies).
- No `.md` endpoints / llms.txt (Phase 21), no new features.

## 8. Docs to update (part of this phase, not optional)

- `CONTEXT.md` — already has Feature Flag / Rich Text terms; verify they match what shipped.
- `docs/architecture/dry-conventions.md` — add the Shared Resources (features, html, image,
  RichText, ImageUpload, seo/*) as the canonical homes; point future code at them.
- `docs/adr/0011-server-rendered-metadata.md` / `0012-trix-html-content.md` — flip Status to
  "Accepted" confirmation if any detail changed during build.
- `README.md` — note the new shared modules under the architecture/section if it lists libs.
- `docs/architecture/overview.md` — reflect product/category/policy now SSR server components.
- This plan file → `git mv docs/plans/proposed/phase-17-foundations.md docs/plans/done/` as the
  final commit (per feedback_plan_lifecycle).

## 9. Self-audit checklist (run before marking phase done — DO NOT skip)

Tick every box; if any fails, the phase is NOT complete.

- [ ] Every Section 2 deliverable exists at the exact path/signature stated (grep to confirm).
- [ ] `isFeatureEnabled` used by both client and worker; no flag read inline elsewhere.
- [ ] Old duplicated code removed: `ProductJsonLd.tsx`, per-file compression configs,
      `CategoryImageUpload.tsx`/old `ImageUpload.tsx` (replaced by shared). `grep` shows no
      leftover duplicates.
- [ ] DOMPurify pinned ≥3.2.4; `sanitizeHtml` runs server-side on every HTML render path.
- [ ] `pnpm verify` green; new pure modules ≥95% unit coverage.
- [ ] Raw HTML of `/product/[slug]` + `/category/[slug]` contains title/description/OG/JSON-LD
      (verified by an automated test, not just by eye).
- [ ] All flags round-trip through `GET /api/config/store` with correct defaults.
- [ ] Worker SSR bundle still under 3 MiB free limit.
- [ ] No edits to any build/output folder; no secrets read or printed.
- [ ] Section 8 docs updated; plan moved to `done/`.
- [ ] Re-read this plan end-to-end and confirm nothing in Sections 2–6 was skipped or stubbed.
</content>
