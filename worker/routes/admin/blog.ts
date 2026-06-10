// Admin blog routes — mounted under /api/admin/blog, behind requireAdmin.
//   GET    /              list all posts (draft + published), newest first
//   POST   /              create post (sanitize body on write, nanoid id)
//   GET    /:id           single post for the editor
//   PATCH  /:id           update post (re-sanitize body on write)
//   DELETE /:id           delete post + reap cover R2 object
//   POST   /:id/publish   set status='published', stamp publishedAt once
//   POST   /:id/unpublish set status='draft'
//   POST   /image         upload cover or inline image to R2
//   DELETE /image/:r2key  delete R2 object

import { Hono } from 'hono'
import { eq, desc } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { createDb } from 'worker/db/index'
import * as schema from 'worker/db/schema'
import { blogPostCreate, blogPostUpdate } from '@/lib/schemas/blog'
import { parseBody } from 'worker/lib/http'
import { bumpDataVersion } from 'worker/lib/version'
import { sanitizeHtml } from 'worker/lib/sanitize'
import type { AdminEnv } from 'worker/lib/access'

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120)
}

function parseTags(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const app = new Hono<AdminEnv>()

// ─── GET / — list all posts ───────────────────────────────────────────────────

app.get('/', async (c) => {
  const db = createDb(c.env.DB)
  const rows = await db
    .select()
    .from(schema.blogPosts)
    .orderBy(desc(schema.blogPosts.createdAt))
    .all()

  const posts = rows.map((r) => ({ ...r, tags: parseTags(r.tags) }))
  return c.json({ posts })
})

// ─── POST / — create post ─────────────────────────────────────────────────────

app.post('/', async (c) => {
  const [body, errResp] = await parseBody(c)
  if (errResp) return errResp

  const parsed = blogPostCreate.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 400)
  }

  const db = createDb(c.env.DB)
  const now = new Date().toISOString()

  // Auto-derive slug from title if caller omits it or sends empty
  let slug = parsed.data.slug || slugify(parsed.data.title)
  if (!slug) slug = nanoid(8)

  // Uniqueness check — 409 on collision
  const [existing] = await db
    .select({ id: schema.blogPosts.id })
    .from(schema.blogPosts)
    .where(eq(schema.blogPosts.slug, slug))
    .limit(1)
  if (existing) {
    return c.json({ error: 'Slug already taken', field: 'slug' }, 409)
  }

  const id = nanoid()
  const publishedAt = parsed.data.status === 'published' ? now : null

  await db.insert(schema.blogPosts).values({
    id,
    slug,
    title: parsed.data.title,
    bodyHtml: sanitizeHtml(parsed.data.bodyHtml),
    excerpt: parsed.data.excerpt,
    coverR2Key: parsed.data.coverR2Key,
    coverAlt: parsed.data.coverAlt,
    tags: JSON.stringify(parsed.data.tags),
    status: parsed.data.status,
    publishedAt,
    createdAt: now,
    updatedAt: now,
  })

  await bumpDataVersion(db)
  return c.json({ ok: true, id, slug }, 201)
})

// ─── GET /:id — single post ───────────────────────────────────────────────────

app.get('/:id', async (c) => {
  const id = c.req.param('id')
  const db = createDb(c.env.DB)

  const [row] = await db.select().from(schema.blogPosts).where(eq(schema.blogPosts.id, id)).limit(1)

  if (!row) return c.notFound()
  return c.json({ ...row, tags: parseTags(row.tags) })
})

// ─── PATCH /:id — update post ─────────────────────────────────────────────────

app.patch('/:id', async (c) => {
  const id = c.req.param('id')

  const [body, errResp] = await parseBody(c)
  if (errResp) return errResp

  const parsed = blogPostUpdate.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 400)
  }

  const db = createDb(c.env.DB)

  const [existing] = await db
    .select()
    .from(schema.blogPosts)
    .where(eq(schema.blogPosts.id, id))
    .limit(1)
  if (!existing) return c.notFound()

  // Slug uniqueness check if slug is changing
  if (parsed.data.slug && parsed.data.slug !== existing.slug) {
    const [taken] = await db
      .select({ id: schema.blogPosts.id })
      .from(schema.blogPosts)
      .where(eq(schema.blogPosts.slug, parsed.data.slug))
      .limit(1)
    if (taken) return c.json({ error: 'Slug already taken', field: 'slug' }, 409)
  }

  const d = parsed.data
  const now = new Date().toISOString()

  // Stamp publishedAt when first transitioning to published
  let publishedAt = existing.publishedAt
  if (d.status === 'published' && !publishedAt) publishedAt = now
  if (d.status === 'draft') publishedAt = existing.publishedAt // preserve original

  await db
    .update(schema.blogPosts)
    .set({
      ...(d.slug !== undefined ? { slug: d.slug } : {}),
      ...(d.title !== undefined ? { title: d.title } : {}),
      ...(d.bodyHtml !== undefined ? { bodyHtml: sanitizeHtml(d.bodyHtml) } : {}),
      ...(d.excerpt !== undefined ? { excerpt: d.excerpt } : {}),
      ...(d.coverR2Key !== undefined ? { coverR2Key: d.coverR2Key } : {}),
      ...(d.coverAlt !== undefined ? { coverAlt: d.coverAlt } : {}),
      ...(d.tags !== undefined ? { tags: JSON.stringify(d.tags) } : {}),
      ...(d.status !== undefined ? { status: d.status } : {}),
      publishedAt,
      updatedAt: now,
    })
    .where(eq(schema.blogPosts.id, id))

  await bumpDataVersion(db)
  return c.json({ ok: true })
})

// ─── DELETE /:id — delete post ────────────────────────────────────────────────

app.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const db = createDb(c.env.DB)

  const [row] = await db
    .select({ coverR2Key: schema.blogPosts.coverR2Key })
    .from(schema.blogPosts)
    .where(eq(schema.blogPosts.id, id))
    .limit(1)
  if (!row) return c.notFound()

  await db.delete(schema.blogPosts).where(eq(schema.blogPosts.id, id))

  // Reap cover image from R2 (Phase 18 pattern)
  if (row.coverR2Key) {
    await c.env.R2.delete(row.coverR2Key).catch(() => {})
  }

  await bumpDataVersion(db)
  return c.json({ ok: true })
})

// ─── POST /:id/publish ────────────────────────────────────────────────────────

app.post('/:id/publish', async (c) => {
  const id = c.req.param('id')
  const db = createDb(c.env.DB)

  const [row] = await db
    .select({ publishedAt: schema.blogPosts.publishedAt })
    .from(schema.blogPosts)
    .where(eq(schema.blogPosts.id, id))
    .limit(1)
  if (!row) return c.notFound()

  const now = new Date().toISOString()
  await db
    .update(schema.blogPosts)
    .set({ status: 'published', publishedAt: row.publishedAt ?? now, updatedAt: now })
    .where(eq(schema.blogPosts.id, id))

  await bumpDataVersion(db)
  return c.json({ ok: true })
})

// ─── POST /:id/unpublish ──────────────────────────────────────────────────────

app.post('/:id/unpublish', async (c) => {
  const id = c.req.param('id')
  const db = createDb(c.env.DB)

  const [row] = await db
    .select({ id: schema.blogPosts.id })
    .from(schema.blogPosts)
    .where(eq(schema.blogPosts.id, id))
    .limit(1)
  if (!row) return c.notFound()

  const now = new Date().toISOString()
  await db
    .update(schema.blogPosts)
    .set({ status: 'draft', updatedAt: now })
    .where(eq(schema.blogPosts.id, id))

  await bumpDataVersion(db)
  return c.json({ ok: true })
})

// ─── POST /image — upload cover or inline Trix image to R2 ───────────────────

app.post('/image', async (c) => {
  const formData = await c.req.formData()
  const file = formData.get('file') as File | null

  if (!file || !(file instanceof File)) {
    return c.json({ error: 'Missing file field' }, 400)
  }
  if (
    !(ALLOWED_IMAGE_TYPES as readonly string[]).includes(
      file.type as (typeof ALLOWED_IMAGE_TYPES)[number],
    )
  ) {
    return c.json({ error: 'Unsupported image type' }, 400)
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return c.json({ error: 'File exceeds 5 MB limit' }, 400)
  }

  const ext = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1]
  const r2Key = `blog/${nanoid()}.${ext}`

  await c.env.R2.put(r2Key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  })

  const imageUrl = `${new URL(c.req.url).origin}/cdn/${r2Key}`
  return c.json({ r2Key, imageUrl }, 201)
})

// ─── DELETE /image/:r2key — remove a blog image from R2 ──────────────────────

app.delete('/image/:r2key{.+}', async (c) => {
  const r2Key = c.req.param('r2key')
  if (!r2Key.startsWith('blog/')) {
    return c.json({ error: 'Invalid key' }, 400)
  }
  await c.env.R2.delete(r2Key).catch(() => {})
  return c.json({ ok: true })
})

export default app
