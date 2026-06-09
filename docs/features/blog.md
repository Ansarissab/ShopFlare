# Blog Feature

Optional merchant blog — articles stored in D1, served as SSR pages, gated by a feature flag.

## Enabling

Admin → Settings → "Enable Blog" toggle. Writes `blogEnabled=true` to `store_config`.
No redeploy. Toggle off hides `/blog`, `/blog/[slug]`, and `/blog/rss.xml` immediately.

## Architecture

```
Admin editor (RichText / Trix)
  → POST /api/admin/blog           — create (sanitizeHtml on write, nanoid id)
  → PATCH /api/admin/blog/:id      — update
  → POST /api/admin/blog/:id/publish    — draft → published, stamp publishedAt
  → POST /api/admin/blog/:id/unpublish  — published → draft

Public consumer
  GET /api/blog                    — published only, cursor pagination on publishedAt
  GET /api/blog/:slug              — single published post
  /blog                            — SSR index (revalidate 60 s)
  /blog/[slug]                     — SSR detail with Article JSON-LD (revalidate 60 s)
  /blog/rss.xml                    — RSS 2.0 feed (force-dynamic)
```

Both public API routes and SSR pages return 404 when `blogEnabled=false`.
Drafts never appear on public routes even by direct slug.

## Data model

Table: `blog_posts` (D1)

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | nanoid |
| `slug` | text unique | URL segment, kebab-case |
| `title` | text | |
| `body_html` | text | sanitized Trix HTML |
| `excerpt` | text | max 300 chars, shown in list cards |
| `cover_r2_key` | text nullable | R2 object key, prefix `blog/` |
| `cover_alt` | text nullable | |
| `tags` | text | JSON-serialized `string[]` |
| `status` | text | `draft` \| `published` |
| `published_at` | text nullable | ISO-8601, stamped once on first publish |
| `created_at` | text | |
| `updated_at` | text | |

Indexes: `blog_posts_status_idx` (status), `blog_posts_published_at_idx` (publishedAt).

## HTML sanitization

`worker/lib/sanitize.ts` — regex-based, CF Workers-compatible.
- Strips `<script>`, `<style>`, event handler attributes, `javascript:` URIs, `data:` URI images
- Enforces `rel="nofollow noopener" target="_blank"` on all anchors
- Applied server-side on every write (create + update)

DOMPurify in `RenderHtml` (`src/components/shared/RenderHtml.tsx`) is the
client-side gate for rendering stored HTML. Both run; the worker-side pass guards
stored content at rest.

**Why not isomorphic-dompurify?** It requires browser DOM globals not available in
the CF workerd runtime — importing it crashes the module at evaluation time.

## Admin UI

- `/admin/blog` — post list with title, status badge, published date; Edit / Publish-toggle / Delete
- `/admin/blog/new` — create editor
- `/admin/blog/:id` — edit editor

Fields: title (auto-derives slug), slug (validated against `CATEGORY_SLUG_PATTERN`),
excerpt, tags (comma-separated → string array), cover image (`ImageUpload`, delete
endpoint `/api/admin/blog/image/:r2key`), cover alt, body (`RichText` with
`uploadEndpoint=/api/admin/blog/image`).

## Schemas

`src/lib/schemas/blog.ts` — extends Zod v4 pattern:

| Schema | Used for |
|---|---|
| `blogPostBase` | full shape, source of truth |
| `blogPostCreate` | POST body |
| `blogPostUpdate` | PATCH body (partial) |
| `blogPostPublic` | public list/detail response (no bodyHtml in list) |

## SEO

- `/blog` — BreadcrumbList JSON-LD, `<link rel="alternate" type="application/rss+xml">` in `<head>`
- `/blog/[slug]` — Article JSON-LD (headline, datePublished, dateModified, image), og:image from cover
- `/blog/rss.xml` — RSS 2.0, items with `<pubDate>` (RFC 2822), XML-escaped title/excerpt
- `sitemap.ts` — `/blog` (priority 0.7) + each published slug (priority 0.5, lastModified = updatedAt)

## Image uploads

Cover and inline Trix images:
- Uploaded via `POST /api/admin/blog/image` → stored as `blog/<nanoid>.<ext>` in R2
- Types: JPEG, PNG, WebP, AVIF; max 5 MB
- D1 stores the R2 key, never a base64 string
- Cover is reaped from R2 on post delete
- Inline images: Trix fires `trix-attachment-add`; `RichText` uploads and replaces the attachment URL

## Testing

- Integration: `worker/test/blog.integration.test.ts` — flag gating, CRUD, draft leak prevention, slug uniqueness, publish/unpublish lifecycle
- Unit: `src/lib/schemas/blog.test.ts` — schema validation, partial update, public field filtering, defaults
- Auth gating tested separately in `worker/lib/access.test.ts` (dev bypass active in integration env)
