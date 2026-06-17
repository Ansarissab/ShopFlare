// Admin landing routes — mounted under /api/admin/landing, behind requireAdmin.
//   GET  /                    assembled landing content (scoped to active or ?pageId=)
//   GET  /pages               all landing pages
//   POST /pages               create a new landing page
//   PATCH /pages/:id          rename a landing page
//   POST /pages/:id/activate  set a page as the active storefront page
//   DELETE /pages/:id         delete a page (guards: not last; reactivate if needed)
//   PUT  /sections/:key       upsert one section (validated by per-section schema)
//   PUT  /featured            replace ordered featured-product ID list
//   POST /image               upload hero/story section image to R2
//   DELETE /image/:r2key      delete a section image from R2

import { Hono } from 'hono'
import type { Context } from 'hono'
import { eq, asc, count, max } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { createDb } from 'worker/db/index'
import type { Database } from 'worker/db/index'
import * as schema from 'worker/db/schema'
import {
  SECTION_SCHEMAS,
  featuredProductsSchema,
  sectionKeySchema,
  landingPageCreateSchema,
  landingPageRenameSchema,
} from '@/lib/schemas/landing'
import type { LandingTemplate } from '@/lib/constants'
import type { LandingSectionInput } from '@/lib/schemas/landing'
import { parseBody } from 'worker/lib/http'
import { sanitizeHtml } from 'worker/lib/sanitize'
import { bumpDataVersion } from 'worker/lib/version'
import { resolveActivePageId } from 'worker/lib/landing'
import type { AdminEnv } from 'worker/lib/access'
import {
  LANDING_SECTION_KEYS,
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  MAX_LANDING_PAGES,
} from '@/lib/constants'
import type { LandingSectionKey } from '@/lib/constants'
import type { LandingPageSummary } from '@/lib/types/landing'

const app = new Hono<AdminEnv>()

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Resolve which landing page to scope a request to.
 * If ?pageId= is present, verify the page exists (404 if not).
 * Otherwise fall back to the active page via resolveActivePageId.
 * Returns [pageId | null, errorResponse | null].
 */
async function resolvePageParam(
  c: Context<AdminEnv>,
  db: Database,
): Promise<[string | null, Response | null]> {
  const qPageId = c.req.query('pageId')
  if (qPageId) {
    const page = await db
      .select({ id: schema.landingPages.id })
      .from(schema.landingPages)
      .where(eq(schema.landingPages.id, qPageId))
      .get()
    if (!page) {
      return [null, c.json({ error: 'Landing page not found' }, 404)]
    }
    return [qPageId, null]
  }
  const pageId = await resolveActivePageId(db)
  return [pageId, null]
}

function toPageSummary(p: {
  id: string
  name: string
  template: LandingTemplate
  isActive: boolean
  sortOrder: number
}): LandingPageSummary {
  return {
    id: p.id,
    name: p.name,
    template: p.template,
    isActive: p.isActive,
    sortOrder: p.sortOrder,
  }
}

// ─── GET / — assembled landing content ───────────────────────────────────────

app.get('/', async (c) => {
  const db = createDb(c.env.DB)

  const [pageId, errResp] = await resolvePageParam(c, db)
  if (errResp) return errResp

  const [sectionRows, featuredRows, allPages] = await Promise.all([
    pageId
      ? db
          .select()
          .from(schema.landingContent)
          .where(eq(schema.landingContent.landingPageId, pageId))
          .all()
      : Promise.resolve([]),
    pageId
      ? db
          .select()
          .from(schema.featuredProducts)
          .where(eq(schema.featuredProducts.landingPageId, pageId))
          .orderBy(asc(schema.featuredProducts.sortOrder))
          .all()
      : Promise.resolve([]),
    db.select().from(schema.landingPages).orderBy(asc(schema.landingPages.sortOrder)).all(),
  ])

  const sections = Object.fromEntries(
    LANDING_SECTION_KEYS.map((key) => {
      const row = sectionRows.find((r) => r.sectionKey === key)
      return [
        key,
        {
          sectionKey: key as LandingSectionKey,
          enabled: row?.enabled ?? true,
          heading: row?.heading ?? null,
          subtext: row?.subtext ?? null,
          bodyHtml: row?.bodyHtml ?? null,
          ctaText: row?.ctaText ?? null,
          ctaHref: row?.ctaHref ?? null,
          imageR2Key: row?.imageR2Key ?? null,
          updatedAt: row?.updatedAt ?? '',
        },
      ]
    }),
  )

  return c.json({
    pageId: pageId ?? null,
    pages: allPages.map(toPageSummary),
    sections,
    featuredProductIds: featuredRows.map((r) => r.productId),
  })
})

// ─── GET /pages — list all landing pages ─────────────────────────────────────

app.get('/pages', async (c) => {
  const db = createDb(c.env.DB)
  const pages = await db
    .select()
    .from(schema.landingPages)
    .orderBy(asc(schema.landingPages.sortOrder))
    .all()
  return c.json({ pages: pages.map(toPageSummary) })
})

// ─── POST /pages — create a new landing page ─────────────────────────────────

app.post('/pages', async (c) => {
  const [body, errResp] = await parseBody(c)
  if (errResp) return errResp

  const parsed = landingPageCreateSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 400)
  }

  const db = createDb(c.env.DB)

  const [{ total }] = await db.select({ total: count() }).from(schema.landingPages).all()
  if (total >= MAX_LANDING_PAGES) {
    return c.json({ error: `Cannot exceed ${MAX_LANDING_PAGES} landing pages` }, 400)
  }

  const [maxRow] = await db
    .select({ maxSort: max(schema.landingPages.sortOrder) })
    .from(schema.landingPages)
    .all()
  const nextSort = (maxRow?.maxSort ?? 0) + 1

  const id = `lp_${nanoid()}`
  const now = new Date().toISOString()

  const template = parsed.data.template ?? 'classic'

  await db.insert(schema.landingPages).values({
    id,
    name: parsed.data.name,
    template,
    isActive: false,
    sortOrder: nextSort,
    createdAt: now,
    updatedAt: now,
  })

  return c.json(
    { page: { id, name: parsed.data.name, template, isActive: false, sortOrder: nextSort } },
    201,
  )
})

// ─── PATCH /pages/:id — rename a landing page ────────────────────────────────

app.patch('/pages/:id', async (c) => {
  const id = c.req.param('id')
  const db = createDb(c.env.DB)

  const existing = await db
    .select({ id: schema.landingPages.id })
    .from(schema.landingPages)
    .where(eq(schema.landingPages.id, id))
    .get()
  if (!existing) {
    return c.json({ error: 'Landing page not found' }, 404)
  }

  const [body, errResp] = await parseBody(c)
  if (errResp) return errResp

  const parsed = landingPageRenameSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 400)
  }

  const { name, template } = parsed.data
  if (name === undefined && template === undefined) {
    return c.json({ error: 'Provide at least one of: name, template' }, 400)
  }

  await db
    .update(schema.landingPages)
    .set({
      ...(name !== undefined ? { name } : {}),
      ...(template !== undefined ? { template } : {}),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.landingPages.id, id))

  return c.json({ ok: true })
})

// ─── POST /pages/:id/activate — set a page as the active storefront page ─────

app.post('/pages/:id/activate', async (c) => {
  const id = c.req.param('id')
  const db = createDb(c.env.DB)

  const existing = await db
    .select({ id: schema.landingPages.id })
    .from(schema.landingPages)
    .where(eq(schema.landingPages.id, id))
    .get()
  if (!existing) {
    return c.json({ error: 'Landing page not found' }, 404)
  }

  const now = new Date().toISOString()
  // Atomic D1 batch: deactivate all, then activate the target in one round-trip.
  await db.batch([
    db.update(schema.landingPages).set({ isActive: false, updatedAt: now }),
    db
      .update(schema.landingPages)
      .set({ isActive: true, updatedAt: now })
      .where(eq(schema.landingPages.id, id)),
  ])

  await bumpDataVersion(db)
  return c.json({ ok: true })
})

// ─── DELETE /pages/:id — delete a landing page ───────────────────────────────

app.delete('/pages/:id', async (c) => {
  const id = c.req.param('id')
  const db = createDb(c.env.DB)

  const existing = await db
    .select({ id: schema.landingPages.id, isActive: schema.landingPages.isActive })
    .from(schema.landingPages)
    .where(eq(schema.landingPages.id, id))
    .get()
  if (!existing) {
    return c.json({ error: 'Landing page not found' }, 404)
  }

  const [{ total }] = await db.select({ total: count() }).from(schema.landingPages).all()
  if (total <= 1) {
    return c.json({ error: 'Cannot delete the last landing page' }, 400)
  }

  // Explicitly delete child rows (D1 may not enforce FK cascade).
  await db.delete(schema.landingContent).where(eq(schema.landingContent.landingPageId, id))
  await db.delete(schema.featuredProducts).where(eq(schema.featuredProducts.landingPageId, id))
  await db.delete(schema.landingPages).where(eq(schema.landingPages.id, id))

  // If the deleted page was active, activate the first remaining page.
  if (existing.isActive) {
    const next = await db
      .select({ id: schema.landingPages.id })
      .from(schema.landingPages)
      .orderBy(asc(schema.landingPages.sortOrder), asc(schema.landingPages.id))
      .get()
    if (next) {
      await db
        .update(schema.landingPages)
        .set({ isActive: true, updatedAt: new Date().toISOString() })
        .where(eq(schema.landingPages.id, next.id))
    }
  }

  await bumpDataVersion(db)
  return c.json({ ok: true })
})

// ─── PUT /sections/:key — upsert one section ─────────────────────────────────

app.put('/sections/:key', async (c) => {
  const keyParam = c.req.param('key')
  const keyParsed = sectionKeySchema.safeParse(keyParam)
  if (!keyParsed.success) {
    return c.json({ error: 'Invalid section key' }, 400)
  }
  const sectionKey = keyParsed.data

  const [body, errResp] = await parseBody(c)
  if (errResp) return errResp

  const sectionSchema = SECTION_SCHEMAS[sectionKey]
  const parsed = sectionSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 400)
  }

  const db = createDb(c.env.DB)

  const [pageId, pageErrResp] = await resolvePageParam(c, db)
  if (pageErrResp) return pageErrResp
  if (!pageId) {
    return c.json({ error: 'No active landing page' }, 404)
  }

  const now = new Date().toISOString()
  const data = parsed.data as LandingSectionInput

  const row = {
    landingPageId: pageId,
    sectionKey,
    enabled: data.enabled ?? true,
    heading: data.heading ?? null,
    subtext: data.subtext ?? null,
    bodyHtml: data.bodyHtml != null ? sanitizeHtml(data.bodyHtml) : null,
    ctaText: data.ctaText ?? null,
    ctaHref: data.ctaHref ?? null,
    imageR2Key: data.imageR2Key ?? null,
    updatedAt: now,
  }

  await db
    .insert(schema.landingContent)
    .values(row)
    .onConflictDoUpdate({
      target: [schema.landingContent.landingPageId, schema.landingContent.sectionKey],
      set: { ...row },
    })

  await bumpDataVersion(db)
  return c.json({ ok: true, sectionKey })
})

// ─── PUT /featured — replace ordered featured-product list ───────────────────

app.put('/featured', async (c) => {
  const [body, errResp] = await parseBody(c)
  if (errResp) return errResp

  const parsed = featuredProductsSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 400)
  }

  const db = createDb(c.env.DB)

  const [pageId, pageErrResp] = await resolvePageParam(c, db)
  if (pageErrResp) return pageErrResp
  if (!pageId) {
    return c.json({ error: 'No active landing page' }, 404)
  }

  await db.delete(schema.featuredProducts).where(eq(schema.featuredProducts.landingPageId, pageId))

  if (parsed.data.productIds.length > 0) {
    await db.insert(schema.featuredProducts).values(
      parsed.data.productIds.map((productId, i) => ({
        landingPageId: pageId,
        productId,
        sortOrder: i,
      })),
    )
  }

  await bumpDataVersion(db)
  return c.json({ ok: true, count: parsed.data.productIds.length })
})

// ─── POST /image — upload section image to R2 ────────────────────────────────

app.post('/image', async (c) => {
  const formData = await c.req.formData()
  const file = formData.get('file') as File | null
  const sectionKey = formData.get('sectionKey') as string | null

  if (!file || !(file instanceof File)) {
    return c.json({ error: 'Missing file field' }, 400)
  }
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return c.json({ error: 'Unsupported image type' }, 400)
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return c.json({ error: 'File exceeds 5 MB limit' }, 400)
  }

  const keyValidation = sectionKeySchema.safeParse(sectionKey)
  if (!keyValidation.success) {
    return c.json({ error: 'Invalid or missing sectionKey' }, 400)
  }

  const ext = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1]
  const r2Key = `landing/${keyValidation.data}/${nanoid()}.${ext}`

  await c.env.R2.put(r2Key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  })

  const imageUrl = `${new URL(c.req.url).origin}/cdn/${r2Key}`
  return c.json({ r2Key, imageUrl }, 201)
})

// ─── DELETE /image/:r2key — remove a section image from R2 ───────────────────

app.delete('/image/:r2key{.+}', async (c) => {
  const r2Key = c.req.param('r2key')
  if (!r2Key.startsWith('landing/')) {
    return c.json({ error: 'Invalid key' }, 400)
  }
  await c.env.R2.delete(r2Key).catch(() => {})
  return c.json({ ok: true })
})

export default app
