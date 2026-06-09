// Admin landing routes — mounted under /api/admin/landing, behind requireAdmin.
//   GET  /                 assembled landing content
//   PUT  /sections/:key    upsert one section (validated by per-section schema)
//   PUT  /featured         replace ordered featured-product ID list
//   POST /image            upload hero/story section image to R2
//   DELETE /image/:r2key   delete a section image from R2

import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { createDb } from 'worker/db/index'
import * as schema from 'worker/db/schema'
import { SECTION_SCHEMAS, featuredProductsSchema, sectionKeySchema } from '@/lib/schemas/landing'
import type { LandingSectionInput } from '@/lib/schemas/landing'
import { parseBody } from 'worker/lib/http'
import { bumpDataVersion } from 'worker/lib/version'
import type { AdminEnv } from 'worker/lib/access'
import { LANDING_SECTION_KEYS } from '@/lib/constants'
import type { LandingSectionKey } from '@/lib/constants'

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const app = new Hono<AdminEnv>()

// ─── GET / — assembled landing content ───────────────────────────────────────

app.get('/', async (c) => {
  const db = createDb(c.env.DB)

  const [sectionRows, featuredRows] = await Promise.all([
    db.select().from(schema.landingContent).all(),
    db.select().from(schema.featuredProducts).orderBy(schema.featuredProducts.sortOrder).all(),
  ])

  const sections = Object.fromEntries(
    LANDING_SECTION_KEYS.map(key => {
      const row = sectionRows.find(r => r.sectionKey === key)
      return [key, {
        sectionKey: key as LandingSectionKey,
        enabled:    row?.enabled ?? true,
        heading:    row?.heading ?? null,
        subtext:    row?.subtext ?? null,
        bodyHtml:   row?.bodyHtml ?? null,
        ctaText:    row?.ctaText ?? null,
        ctaHref:    row?.ctaHref ?? null,
        imageR2Key: row?.imageR2Key ?? null,
        updatedAt:  row?.updatedAt ?? '',
      }]
    }),
  )

  return c.json({
    sections,
    featuredProductIds: featuredRows.map(r => r.productId),
  })
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
  const now = new Date().toISOString()
  // Cast to base type — all per-section schemas are subsets of the base,
  // so every field is already optional; we just need a single typed shape.
  const data = parsed.data as LandingSectionInput

  const row = {
    sectionKey,
    enabled:    data.enabled ?? true,
    heading:    data.heading    ?? null,
    subtext:    data.subtext    ?? null,
    bodyHtml:   data.bodyHtml   ?? null,
    ctaText:    data.ctaText    ?? null,
    ctaHref:    data.ctaHref    ?? null,
    imageR2Key: data.imageR2Key ?? null,
    updatedAt:  now,
  }

  await db
    .insert(schema.landingContent)
    .values(row)
    .onConflictDoUpdate({
      target: schema.landingContent.sectionKey,
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

  await db.delete(schema.featuredProducts).execute()

  if (parsed.data.productIds.length > 0) {
    await db.insert(schema.featuredProducts).values(
      parsed.data.productIds.map((productId, i) => ({ productId, sortOrder: i })),
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
