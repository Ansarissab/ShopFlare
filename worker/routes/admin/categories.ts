// Admin category routes — mounted under /api/admin/categories, behind requireAdmin.
// Full CRUD: create, update, soft-delete, image upload/remove, list, get.

import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { createDb } from 'worker/db/index'
import * as schema from 'worker/db/schema'
import { assembleCategoryTree, assertValidParent } from 'worker/lib/categories'
import { parseBody } from 'worker/lib/http'
import { createCategorySchema, updateCategorySchema } from '@/lib/schemas'
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from '@/lib/constants'
import { slugify } from '@/lib/utils/index'
import type { AdminEnv } from 'worker/lib/access'
import { bumpDataVersion } from 'worker/lib/version'

const app = new Hono<AdminEnv>()

// ─── GET / — full tree including inactive (for admin management view) ─────────

app.get('/', async (c) => {
  const db = createDb(c.env.DB)
  const categories = await assembleCategoryTree(db, { includeInactive: true })
  return c.json({ categories })
})

// ─── GET /:id — single category ──────────────────────────────────────────────

app.get('/:id', async (c) => {
  const { id } = c.req.param()
  const db = createDb(c.env.DB)
  const category = await db
    .select()
    .from(schema.categories)
    .where(eq(schema.categories.id, id))
    .get()
  if (!category) return c.json({ error: 'Category not found' }, 404)
  return c.json({ category })
})

// ─── POST / — create category ─────────────────────────────────────────────────

app.post('/', async (c) => {
  const [body, errResp] = await parseBody(c)
  if (errResp) return errResp

  const parsed = createCategorySchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 400)
  }

  const db = createDb(c.env.DB)
  const { name, slug: slugInput, description, parentId, sortOrder, active } = parsed.data

  // Derive slug if not provided
  const slug = slugInput ?? slugify(name)

  // Validate parent (throws on depth violation)
  try {
    await assertValidParent(db, parentId ?? null)
  } catch (err) {
    return c.json({ error: (err as Error).message }, 422)
  }

  // Check slug uniqueness
  const existing = await db
    .select()
    .from(schema.categories)
    .where(eq(schema.categories.slug, slug))
    .get()
  if (existing) return c.json({ error: 'Slug already exists' }, 409)

  const id = nanoid()
  const now = new Date().toISOString()

  await db.insert(schema.categories).values({
    id,
    name,
    slug,
    description: description ?? '',
    parentId: parentId ?? null,
    sortOrder: sortOrder ?? 0,
    active: active ?? true,
    createdAt: now,
    updatedAt: now,
  })

  const [category] = await Promise.all([
    db.select().from(schema.categories).where(eq(schema.categories.id, id)).get(),
    bumpDataVersion(db),
  ])

  return c.json({ category }, 201)
})

// ─── PUT /:id — update category ───────────────────────────────────────────────

app.put('/:id', async (c) => {
  const { id } = c.req.param()
  const [body, errResp] = await parseBody(c)
  if (errResp) return errResp

  const parsed = updateCategorySchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 400)
  }

  const db = createDb(c.env.DB)

  const existing = await db
    .select()
    .from(schema.categories)
    .where(eq(schema.categories.id, id))
    .get()
  if (!existing) return c.json({ error: 'Category not found' }, 404)

  // Re-validate parent if being changed
  if ('parentId' in parsed.data) {
    try {
      await assertValidParent(db, parsed.data.parentId ?? null, id)
    } catch (err) {
      return c.json({ error: (err as Error).message }, 422)
    }
  }

  // Slug uniqueness check if slug is changing
  if (parsed.data.slug && parsed.data.slug !== existing.slug) {
    const slugConflict = await db
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.slug, parsed.data.slug))
      .get()
    if (slugConflict) return c.json({ error: 'Slug already exists' }, 409)
  }

  const now = new Date().toISOString()
  await db
    .update(schema.categories)
    .set({ ...parsed.data, updatedAt: now })
    .where(eq(schema.categories.id, id))

  const [category] = await Promise.all([
    db.select().from(schema.categories).where(eq(schema.categories.id, id)).get(),
    bumpDataVersion(db),
  ])

  return c.json({ category })
})

// ─── DELETE /:id — soft-delete: set active=false, null out children's parentId ─

app.delete('/:id', async (c) => {
  const { id } = c.req.param()
  const db = createDb(c.env.DB)

  const existing = await db
    .select()
    .from(schema.categories)
    .where(eq(schema.categories.id, id))
    .get()
  if (!existing) return c.json({ error: 'Category not found' }, 404)

  const now = new Date().toISOString()

  // Null out children's parentId (soft-delete doesn't trigger FK onDelete:'set null')
  await db
    .update(schema.categories)
    .set({ parentId: null, updatedAt: now })
    .where(eq(schema.categories.parentId, id))

  await db
    .update(schema.categories)
    .set({ active: false, updatedAt: now })
    .where(eq(schema.categories.id, id))

  await bumpDataVersion(db)

  return c.json({ ok: true })
})

// ─── POST /:id/image — upload category hero image to R2 (multipart) ──────────
// FormData: file (Blob)

app.post('/:id/image', async (c) => {
  const { id } = c.req.param()
  const db = createDb(c.env.DB)

  const category = await db
    .select()
    .from(schema.categories)
    .where(eq(schema.categories.id, id))
    .get()
  if (!category) return c.json({ error: 'Category not found' }, 404)

  const formData = await c.req.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return c.json({ error: 'file is required' }, 400)
  }

  // Server-side validation — never trust the client compression step.
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return c.json({ error: `Unsupported image type: ${file.type || 'unknown'}` }, 415)
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return c.json(
      { error: `Image exceeds ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB limit` },
      413,
    )
  }

  // Delete old R2 object if one existed
  if (category.r2Key) {
    await c.env.R2.delete(category.r2Key)
  }

  // Extension derived from the validated MIME type (not the client filename).
  const ext = file.type === 'image/jpeg' ? 'jpg' : (file.type.split('/')[1] ?? 'jpg')
  const imageId = nanoid()
  const r2Key = `categories/${id}/${imageId}.${ext}`

  await c.env.R2.put(r2Key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  })

  // Public URL served by the Worker's own /cdn/* route (same origin as product images).
  const imageUrl = `${new URL(c.req.url).origin}/cdn/${r2Key}`

  const now = new Date().toISOString()
  await db
    .update(schema.categories)
    .set({ imageUrl, r2Key, updatedAt: now })
    .where(eq(schema.categories.id, id))

  const [updated] = await Promise.all([
    db.select().from(schema.categories).where(eq(schema.categories.id, id)).get(),
    bumpDataVersion(db),
  ])

  return c.json({ category: updated })
})

// ─── DELETE /:id/image — remove category hero image ──────────────────────────

app.delete('/:id/image', async (c) => {
  const { id } = c.req.param()
  const db = createDb(c.env.DB)

  const category = await db
    .select()
    .from(schema.categories)
    .where(eq(schema.categories.id, id))
    .get()
  if (!category) return c.json({ error: 'Category not found' }, 404)

  if (!category.r2Key) {
    return c.json({ error: 'No image to delete' }, 404)
  }

  await c.env.R2.delete(category.r2Key)

  const now = new Date().toISOString()
  await db
    .update(schema.categories)
    .set({ imageUrl: null, r2Key: null, updatedAt: now })
    .where(eq(schema.categories.id, id))

  const [updated] = await Promise.all([
    db.select().from(schema.categories).where(eq(schema.categories.id, id)).get(),
    bumpDataVersion(db),
  ])

  return c.json({ category: updated })
})

export default app
