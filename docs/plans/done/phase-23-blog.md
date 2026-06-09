# Plan 23 — Blog (SEO content + R2 image storage)

Please talk to me with grill me skill before starting this phase, I need to make sure if alongside Trix editor if we need to add MDX as well.

Roadmap items: **#8** (blog for SEO) + **#9** (blog image storage — research-settled: R2).

Dynamic-First: the Merchant writes and publishes posts from the Admin Dashboard. No
redeploy to add/edit/delete a post or flip the feature on. Off-state is enforced
server-side, not merely hidden in the UI (per [`CONTEXT.md`](../../../CONTEXT.md) §Feature Flag).

## 1. Goal

Give the storefront an optional, SEO-first **Blog**: Merchant-authored articles written
in the shared Trix [`<RichText>`](../../../src/components/shared/RichText.tsx) editor,
stored in D1 as sanitized HTML, with a cover image and inline images in R2. Server-rendered
`/blog` index + `/blog/[slug]` post pages carry `Article` structured data, feed the
sitemap, and expose an RSS feed. The whole capability is gated by a `blogEnabled` Feature
Flag (default **false**) so a fresh install ships with no blog surface at all.

Two locked decisions this plan implements:

1. **Storage = D1 + R2.** Post metadata + sanitized body HTML live in D1; images live in
   R2 (we store only the R2 key + alt + dimensions in D1) and are served via the existing
   `/cdn/{key}` route. See §5 for the cost rationale.
2. **No new content stack.** Everything composes Phase 17/18/21 primitives — Trix
   `<RichText>`, `sanitizeHtml`/`<RenderHtml>`, `<ImageUpload>`/`compressImage`, and the
   SEO helpers. We add a `blog_posts` table, routes, two server pages, an RSS route, and
   strings. Nothing is reinvented.

## 2. Current state (refs)

- **No blog today, no markdown lib.** The closest existing pattern is **policy pages**:
  stored in D1 as `StorePage {slug,title,content,updatedAt}`
  ([`src/lib/types/admin.ts:158-167`](../../../src/lib/types/admin.ts)), edited at
  [`src/app/(admin)/admin/pages/page.tsx`](../../../src/app/(admin)/admin/pages/page.tsx),
  rendered plain-text `whitespace-pre-wrap` at
  [`src/app/(store)/policy/[slug]/page.tsx`](../../../src/app/(store)/policy/[slug]/page.tsx).
  Blog differs: rich HTML body (not plain text), draft/publish lifecycle, cover image, and
  it is **server-rendered** (policy is a `'use client'` page) so the `Article` JSON-LD and
  metadata land in the initial HTML for crawlers.
- **Admin sidebar nav** is a static `navItems` array —
  [`src/components/admin/shared/AdminSidebar.tsx:15-27`](../../../src/components/admin/shared/AdminSidebar.tsx).
  Add one `/admin/blog` entry (label from `en`, icon from `lucide-react`).
- **Sitemap** [`src/app/sitemap.ts`](../../../src/app/sitemap.ts) already fans out product +
  category routes by fetching the public API at build/revalidate time. Add a `blogRoutes`
  block the same way (skip when the flag is off / API unavailable).
- **Image upload + `/cdn`**: multipart R2 upload at
  [`worker/routes/admin/products.ts:368-428`](../../../worker/routes/admin/products.ts)
  (validates MIME against `ALLOWED_IMAGE_TYPES`, size against `MAX_IMAGE_BYTES`, derives the
  key, `R2.put`, serves via same-origin `/cdn/<key>`). `/cdn/*` streaming route +
  `immutable` cache at [`worker/index.ts:37-53`](../../../worker/index.ts). Blog reuses this
  exact path — no new upload mechanism.
- **Store config k/v table** `store_config {key,value,updatedAt}` —
  [`worker/db/schema.ts:168-172`](../../../worker/db/schema.ts). `blogEnabled` is one more key.
- **Migrations** live in [`worker/db/migrations/`](../../../worker/db/migrations/) (latest
  `0005_categories.sql`); generated via Drizzle from
  [`worker/db/schema.ts`](../../../worker/db/schema.ts).
- **CONTEXT.md** already defines the **Blog** and **Rich Text** terms
  ([`CONTEXT.md:109-112`](../../../CONTEXT.md)) — verify, do not re-add.

### Depends on (reuse — do NOT redefine)

- **Phase 17** — `<RichText>` Trix wrapper (`src/components/shared/RichText.tsx`) for the
  body editor; `sanitizeHtml` + `<RenderHtml>` (`src/lib/html.ts`) for storing + rendering
  body HTML; `<ImageUpload>` + `compressImage` for cover + Trix inline images (→ R2, never
  base64).
- **Phase 18** — image-confirm flow (R2 object kept only when the post is saved; orphans
  reaped). Blog cover + inline images ride this path.
- **Phase 21** — SSR server-component pattern + `buildPageMetadata` + `<JsonLd>` +
  `articleJsonLd` (`src/lib/seo/*`); `isFeatureEnabled` helper + the `blogEnabled` flag;
  sitemap + `llms.txt` plumbing.

> These helpers do **not** exist on `main` yet (verified — no `src/lib/seo/`, `src/lib/html.ts`,
> `src/components/shared/RichText.tsx`, or `isFeatureEnabled`). Phase 17/18/21 land first.
> This plan **consumes** them; if a primitive is missing at build time, extend it in its
> Phase home, not here.

## 3. Schema / DB

### 3.1 Drizzle migration — `blog_posts`

Add to [`worker/db/schema.ts`](../../../worker/db/schema.ts), then
`pnpm drizzle:generate` → review SQL → it lands as `worker/db/migrations/0006_*.sql`.

```ts
export const blogPosts = sqliteTable('blog_posts', {
  id:          text('id').primaryKey(),                 // nanoid
  slug:        text('slug').notNull().unique(),         // URL-safe, from title
  title:       text('title').notNull(),
  bodyHtml:    text('body_html').notNull(),             // sanitized HTML (sanitizeHtml on write)
  excerpt:     text('excerpt').notNull().default(''),   // list cards + meta description fallback
  coverR2Key:  text('cover_r2_key'),                    // R2 object key (nullable)
  coverAlt:    text('cover_alt'),                        // alt text for the cover
  tags:        text('tags').notNull().default('[]'),    // JSON string array (DRY: matches how other lists serialize)
  status:      text('status').notNull().default('draft'), // 'draft' | 'published' (constant, not free text)
  publishedAt: text('published_at'),                     // set when first published; null while draft
  createdAt:   text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt:   text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (t) => ({
  statusIdx:      index('blog_posts_status_idx').on(t.status),
  publishedAtIdx: index('blog_posts_published_at_idx').on(t.publishedAt),
  // slug already uniquely indexed by .unique()
}))
```

Index rationale: public list filters `status = 'published'` and orders by `publishedAt desc`
(both indexed); single-post + admin edit lookups hit the unique `slug`.

### 3.2 Zod schemas (extend bases — never inline)

In [`src/lib/schemas/`](../../../src/lib/schemas/) (new `blog.ts`), derive from a single base
per the DRY OOP rule (`.extend`/`.pick`/`.omit`, never re-declare fields):

```ts
export const BLOG_STATUSES = ['draft', 'published'] as const   // → src/lib/constants/index.ts

export const blogPostBase = z.object({
  slug:        z.string().min(1).max(120).regex(SLUG_RE),   // reuse SLUG_RE if one exists
  title:       z.string().min(1).max(200),
  bodyHtml:    z.string().min(1),
  excerpt:     z.string().max(300).default(''),
  coverR2Key:  z.string().nullable().default(null),
  coverAlt:    z.string().max(200).nullable().default(null),
  tags:        z.array(z.string().max(40)).max(20).default([]),
  status:      z.enum(BLOG_STATUSES).default('draft'),
})

export const blogPostCreate = blogPostBase                    // server fills id/slug/timestamps
export const blogPostUpdate = blogPostBase.partial()          // PATCH-style partial edits
export const blogPostPublic = blogPostBase.pick({ slug:true, title:true, excerpt:true, coverR2Key:true, coverAlt:true, tags:true })
```

Shared between client form and Worker route (same file imported both sides), per the
network/validation DRY rules.

### 3.3 Types

Infer from the Drizzle table; composite/admin/public shapes go in
[`src/lib/types/store.ts`](../../../src/lib/types/store.ts) (or `admin.ts` for the admin
list shape, mirroring `AdminPagesResponse`). No per-file `*Props` declarations.

```ts
export type BlogPost = typeof blogPosts.$inferSelect           // from schema
export interface BlogListResponse { posts: BlogPostSummary[]; nextCursor: string | null }
```

## 4. Deliverables

### (a) Worker routes

New `worker/routes/admin/blog.ts` (mounted under the existing admin router) +
public handlers in `worker/routes/blog.ts` (or extend the public router). All admin
mutations behind `requireAdmin`; all public reads gated on `blogEnabled` **server-side**.

Admin (Bearer-gated):
- `GET    /api/admin/blog` — list all (draft + published), newest first.
- `POST   /api/admin/blog` — create (validate `blogPostCreate`; `sanitizeHtml(bodyHtml)`
  on write; slug uniqueness check → 409 on collision; `nanoid` id).
- `GET    /api/admin/blog/:id` — single (for the editor).
- `PATCH  /api/admin/blog/:id` — update (validate `blogPostUpdate`; re-sanitize body).
- `DELETE /api/admin/blog/:id` — delete (and reap the cover R2 object per Phase 18 reaping).
- `POST   /api/admin/blog/:id/publish` — set `status='published'`, stamp `publishedAt` if
  null (idempotent); a matching unpublish path flips back to `draft`.

Public:
- `GET /api/blog` — **published only**, paginated (cursor on `publishedAt`/`id`). Returns
  `blogPostPublic` summaries (no draft leakage). **First line of the handler:** if
  `!isFeatureEnabled('blogEnabled')` → `404` (not an empty list — the surface must not exist).
- `GET /api/blog/:slug` — single **published** post. Flag off → 404. Draft slug → 404
  (never serve a draft on the public route, even by direct slug).

Sanitize-on-write (DRY): body HTML passes through `sanitizeHtml` (DOMPurify ≥3.2.4, the
Phase 17 helper) in the Worker before insert/update, so the public render path can trust
stored HTML. SVG inline art is sanitized too and served via `<img>` (no inline `<svg>` DOM
injection).

### (b) Admin UI

- `src/app/(admin)/admin/blog/page.tsx` — list (title, status badge, publishedAt, tags),
  "New post" button, row actions (edit / publish-unpublish / delete). Data via
  [`src/lib/api.ts`](../../../src/lib/api.ts) (`apiGet('/api/admin/blog')`) — never raw fetch.
- `src/app/(admin)/admin/blog/[id]/page.tsx` (+ a `new` route or `id='new'`) — editor:
  - title (slug auto-derived from title, editable, debounced uniqueness hint),
  - `<RichText>` body (Trix → sanitized HTML; inline image button uploads to R2 via the
    shared upload path, **not** base64),
  - `<ImageUpload>` cover (one image → R2 key + alt; `compressImage` client-side first),
  - excerpt, tags input, draft/publish toggle + Save.
- Sidebar: add `{ href: '/admin/blog', label: en.admin.blog, icon: <Newspaper/FileText> }`
  to `navItems` in
  [`AdminSidebar.tsx:15-27`](../../../src/components/admin/shared/AdminSidebar.tsx).

### (c) Storefront SSR

Both are **server components** (RSC), unlike the client-side policy page, so JSON-LD +
metadata are in the initial HTML.

- `src/app/(store)/blog/page.tsx` — index: fetch published list server-side, render cards
  (cover via `/cdn/<coverR2Key>`, title, excerpt, date, tags). `export const metadata` /
  `generateMetadata` via `buildPageMetadata`. If `blogEnabled` is off → `notFound()`.
- `src/app/(store)/blog/[slug]/page.tsx` — post: fetch by slug server-side, `<RenderHtml>`
  the body, `generateMetadata` (title/excerpt/cover OG image), inject
  `<JsonLd data={articleJsonLd(post)} />` + a `BreadcrumbList` (Home → Blog → Post). Flag
  off or draft → `notFound()`. `generateStaticParams` optional; rely on revalidate so new
  posts appear without redeploy (Dynamic-First).

### (d) RSS feed

- `src/app/(store)/blog/rss.xml/route.ts` (Route Handler) → `Content-Type:
  application/rss+xml`. Emit the published posts (title, link, `guid`, `pubDate` from
  `publishedAt`, `description` from excerpt). XML-escape all fields. Flag off → 404. Link it
  from the blog index `<head>` (`<link rel="alternate" type="application/rss+xml">`).

### (e) Sitemap

Extend [`src/app/sitemap.ts`](../../../src/app/sitemap.ts) with a `blogRoutes` block
mirroring `productRoutes`: fetch `/api/blog` (which already 404s when the flag is off, so no
extra flag check needed — guard the `res.ok`), map each published slug to
`${siteUrl}/blog/${slug}` (`changeFrequency: 'weekly'`, `priority: 0.5`), plus the `/blog`
index itself. Wrap in try/catch like the existing blocks.

### (f) Strings — `en.ts`

All UI text in [`src/lib/i18n/en.ts`](../../../src/lib/i18n/en.ts): `en.admin.blog` (nav
label) + an `en.admin.blogEditor.*` group (title/slug/excerpt/tags/cover/publish/draft/
delete-confirm) + `en.blog.*` storefront group (index heading, "no posts yet" empty state,
read-more, published-on, breadcrumb). Never hardcode in JSX.

### (g) `blogEnabled` toggle

Add `blogEnabled` to the admin Settings page (store_config k/v, default `false`), alongside
the other feature flags. Read via `isFeatureEnabled('blogEnabled')` server-side in every
public blog route/page (single source — DRY). Flipping it requires **no redeploy**
(Dynamic-First).

## 5. Image strategy (#9 — research-settled: R2)

Cover + Trix inline images go to **R2** via the shared `<ImageUpload>` / Worker upload path
([`worker/routes/admin/products.ts:368-428`](../../../worker/routes/admin/products.ts)),
served by the same-origin `/cdn/<key>` route
([`worker/index.ts:37-53`](../../../worker/index.ts), `immutable` 1-year cache). D1 stores
only the R2 **key** + alt + (optionally) dimensions — never the bytes. Formats: AVIF/WebP
(compressed client-side via `compressImage` before upload). Responsive: emit `srcset`/sizes
where the cover is large; ship a sub-2KB base64 blur LQIP placeholder if Phase 18 provides one.

**base64-in-D1 is REJECTED.** Rationale (brief):
- +33% bytes over binary, and it **kills browser/CDN caching** (the bytes re-download inside
  every HTML/JSON payload instead of being cached once at `/cdn`).
- It burns the **hard-capped 500 MB D1 free tier ~25× faster** than storing keys, so the
  $0 budget dies fast as the blog grows.
- Inline-encoded images **never appear in Google Image search** (no crawlable URL), defeating
  the SEO point of the whole phase.

base64 is allowed **only** for tiny inline icons or a sub-2KB blur LQIP placeholder. SVG is
allowed only for vector art, **sanitized** (DOMPurify ≥3.2.4) and served via `<img>`.

**Cost math:** R2 free tier = 10 GB storage + free egress ≈ ~100k optimized AVIF/WebP
images (a typical post cover is well under 100 KB). A blog of hundreds of posts stays
comfortably **$0**; D1 holds only short key strings, so the 500 MB cap is never the
bottleneck.

## 6. Rollout (small commits — conventional commits)

1. `feat(db): add blog_posts table + indexes (Drizzle migration 0006)`
2. `feat(schemas): blogPostBase + create/update/public via extend/pick; BLOG_STATUSES const`
3. `feat(worker): admin blog CRUD + publish behind requireAdmin, sanitize-on-write`
4. `feat(worker): public GET /api/blog (+ :slug), gated on blogEnabled server-side, drafts hidden`
5. `feat(admin): /admin/blog list + editor (RichText body, ImageUpload cover, slug auto, tags); sidebar nav`
6. `feat(store): SSR /blog index + /blog/[slug] with RenderHtml, metadata, articleJsonLd + BreadcrumbList`
7. `feat(store): blog RSS feed route + <head> alternate link`
8. `feat(seo): include published posts + /blog in sitemap`
9. `feat(admin): blogEnabled feature-flag toggle in Settings (default false)`
10. `feat(i18n): blog admin + storefront strings in en.ts`
11. `test: route gating, draft visibility, SSR metadata/JSON-LD, RSS, sitemap`
12. `docs: blog feature doc + architecture/schema/README updates; mv plan to done/`

Each commit is independently green (`pnpm verify --quick` at least; full `pnpm verify`
before the test/docs commits).

## 7. Acceptance

**Flag OFF (default):**
- `/blog` and `/blog/[slug]` return `notFound()` (404), nothing rendered.
- `GET /api/blog` and `GET /api/blog/:slug` return 404 (not empty 200).
- `/blog/rss.xml` returns 404. Sitemap contains no blog routes.

**Flag ON:**
- `/blog` lists published posts; `/blog/[slug]` renders the sanitized body via `<RenderHtml>`.
- View-source shows the `Article` JSON-LD **and** the metadata/OG tags in the **raw HTML**
  (proves SSR, not client hydration) + a `BreadcrumbList`.
- A **draft** post is never reachable publicly — not in `/api/blog`, not via direct
  `/blog/<draft-slug>` (both 404), and not in the sitemap or RSS.
- `/blog/rss.xml` is valid RSS 2.0 (well-formed XML, escaped fields, `pubDate`s).
- Sitemap includes each published `/blog/<slug>` + the `/blog` index.
- Cover + Trix inline images resolve from `/cdn/<key>` (R2); D1 stores keys, **no base64
  image blobs** in `body_html` or any column.

**Tests (regression-permanent):**
- Route gating: flag off → 404 on every public blog route; admin routes 401 without Bearer.
- Draft visibility: draft excluded from public list + slug + sitemap + RSS.
- SSR: `generateMetadata` output + `articleJsonLd` present in server-rendered HTML.
- RSS: response is parseable XML with the published set.
- Worker route behavior is covered by the **integration** suite (workerd pool), not line %
  (per `docs/adr/0008`); pure helpers (slug derive, RSS XML build, sanitize wrapper) are
  unit-tested toward the 95% gate.

## 8. Non-goals (V2 candidates)

- **No comments** (no UGC moderation surface in v1).
- **No categories/authors taxonomy** beyond free-form `tags` — a single tag string array is
  the whole taxonomy for v1.
- **No scheduled publishing** — publish is immediate (no future `publishedAt` cron). *(V2: a
  CF Cron Trigger that flips scheduled posts live.)*
- **No multi-language** — single-locale `en.ts` only. *(V2 with i18n.)*
- No per-post SEO overrides beyond title/excerpt/cover; no related-posts; no reading-time.

## 9. Docs to update

- [`CONTEXT.md`](../../../CONTEXT.md) — **Blog** + **Rich Text** terms already present
  (lines 109-112). **Verify** wording still matches the shipped schema; do not duplicate.
- **New** `docs/features/blog.md` — Merchant-facing: how to write, cover/inline images,
  draft vs publish, the `blogEnabled` toggle, RSS/sitemap behavior.
- [`docs/architecture/overview.md`](../../../docs/architecture/overview.md) — note the blog
  surface (SSR pages + admin CRUD + RSS) and that images are R2-only.
- `docs/architecture/database-schema.md` — document the `blog_posts` table + indexes.
- `README.md` — add Blog to the feature list (note: optional, flag-gated, default off).
- **Plan lifecycle:** when 100% done + audited, `git mv docs/plans/proposed/phase-23-blog.md
  docs/plans/done/` and commit as the final step.

## 10. Self-audit checklist

- [ ] `blog_posts` migration generated from schema + applied; indexes on `status`,
      `publishedAt`, and unique `slug` exist.
- [ ] Admin CRUD + publish behind `requireAdmin`; public `GET /api/blog` (+ `:slug`) gate on
      `blogEnabled` **server-side** (404 when off, not empty 200).
- [ ] A **draft** is never public — excluded from public API, `/blog/[slug]`, sitemap, and RSS.
- [ ] `<RichText>`, `sanitizeHtml`/`<RenderHtml>`, `<ImageUpload>`/`compressImage`, and the
      SEO helpers (`buildPageMetadata`/`<JsonLd>`/`articleJsonLd`) are **reused, not
      reimplemented**; Zod derived via `.extend`/`.pick`; constants in `lib/constants`.
- [ ] Cover + inline images live in **R2** (D1 stores keys only) — **no base64 image blobs**
      in any column; SVG sanitized; base64 only for sub-2KB LQIP/icons.
- [ ] `Article` JSON-LD + metadata + `BreadcrumbList` are in the **server-rendered HTML**
      (view-source confirms), not client-injected.
- [ ] RSS feed is valid XML and gated on the flag; sitemap includes published posts + `/blog`.
- [ ] All UI strings in [`en.ts`](../../../src/lib/i18n/en.ts); no hardcoded JSX text;
      network only via [`lib/api.ts`](../../../src/lib/api.ts).
- [ ] Tests added: route gating, draft visibility, SSR metadata/JSON-LD, RSS, sitemap.
- [ ] `pnpm verify` (typecheck → lint → unit+coverage → integration → build) is **green**.
- [ ] Plan re-read end-to-end; `git mv` proposed → done/ as the final commit.
