// Admin config routes — mounted under /api/admin/config, behind requireAdmin.
// The public, read-only GET /api/config/store lives in routes/config.ts.

import { Hono } from 'hono'
import { nanoid } from 'nanoid'
import { eq } from 'drizzle-orm'
import { createDb } from 'worker/db/index'
import * as schema from 'worker/db/schema'
import { updateConfigSchema } from '@/lib/schemas'
import { parseBody } from 'worker/lib/http'
import { bumpDataVersion } from 'worker/lib/version'
import type { AdminEnv } from 'worker/lib/access'

const MAX_BRANDING_BYTES = 2 * 1024 * 1024
const ALLOWED_BRANDING_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'] as const

const app = new Hono<AdminEnv>()

// ─── PUT /store — upsert store config ─────────────────────────────────────────

app.put('/store', async (c) => {
  const [body, errResp] = await parseBody(c)
  if (errResp) return errResp

  const parsed = updateConfigSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 400)
  }

  const db = createDb(c.env.DB)
  const now = new Date().toISOString()

  const updates = Object.entries(parsed.data).filter(([, v]) => v !== undefined)

  // Keys whose values are JSON-serialized objects/arrays (not comma-joined strings).
  // announcementMessages and faqItems are arrays of objects — String() would yield "[object Object]".
  const JSON_SERIALIZED_KEYS = new Set(['announcementMessages', 'faqItems'])

  for (const [key, value] of updates) {
    // faqContent is deprecated (phase 30) — ignore it on write; clients should
    // send faqItems instead. Existing faqContent in D1 is kept for migration fallback.
    if (key === 'faqContent') continue
    const serialized = JSON_SERIALIZED_KEYS.has(key) ? JSON.stringify(value) : String(value)
    await db
      .insert(schema.storeConfig)
      .values({ key, value: serialized, updatedAt: now })
      .onConflictDoUpdate({
        target: schema.storeConfig.key,
        set: { value: serialized, updatedAt: now },
      })
  }

  await bumpDataVersion(db)

  return c.json({ ok: true, updated: updates.map(([k]) => k) })
})

// ─── POST /logo — upload store logo to R2 ────────────────────────────────────

app.post('/logo', async (c) => {
  const formData = await c.req.formData()
  const file = formData.get('file') as File | null

  if (!file || !(file instanceof File)) {
    return c.json({ error: 'Missing file field' }, 400)
  }
  if (!(ALLOWED_BRANDING_TYPES as readonly string[]).includes(file.type)) {
    return c.json({ error: 'Unsupported file type' }, 400)
  }
  if (file.size > MAX_BRANDING_BYTES) {
    return c.json({ error: 'File exceeds 2 MB limit' }, 400)
  }

  const db = createDb(c.env.DB)

  // Delete old logo from R2 if one exists
  const existing = await db
    .select()
    .from(schema.storeConfig)
    .where(eq(schema.storeConfig.key, 'logoR2Key'))
    .get()
  if (existing?.value) {
    await c.env.R2.delete(existing.value).catch(() => {})
  }

  // Content-addressed R2 key
  const ext =
    file.type === 'image/svg+xml'
      ? 'svg'
      : file.type === 'image/jpeg'
        ? 'jpg'
        : file.type.split('/')[1]
  const r2Key = `branding/logo-${nanoid()}.${ext}`

  await c.env.R2.put(r2Key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  })

  const logoUrl = `${new URL(c.req.url).origin}/cdn/${r2Key}`
  const now = new Date().toISOString()

  for (const [key, value] of [
    ['logoUrl', logoUrl],
    ['logoR2Key', r2Key],
  ] as [string, string][]) {
    await db
      .insert(schema.storeConfig)
      .values({ key, value, updatedAt: now })
      .onConflictDoUpdate({ target: schema.storeConfig.key, set: { value, updatedAt: now } })
  }

  await bumpDataVersion(db)

  return c.json({ logoUrl }, 201)
})

// ─── DELETE /logo — remove store logo ────────────────────────────────────────

app.delete('/logo', async (c) => {
  const db = createDb(c.env.DB)

  const existing = await db
    .select()
    .from(schema.storeConfig)
    .where(eq(schema.storeConfig.key, 'logoR2Key'))
    .get()
  if (existing?.value) {
    await c.env.R2.delete(existing.value).catch(() => {})
  }

  const now = new Date().toISOString()

  for (const key of ['logoUrl', 'logoR2Key']) {
    await db
      .insert(schema.storeConfig)
      .values({ key, value: '', updatedAt: now })
      .onConflictDoUpdate({ target: schema.storeConfig.key, set: { value: '', updatedAt: now } })
  }

  await bumpDataVersion(db)

  return c.json({ ok: true })
})

// ─── POST /favicon — upload store favicon to R2 ──────────────────────────────

app.post('/favicon', async (c) => {
  const formData = await c.req.formData()
  const file = formData.get('file') as File | null

  if (!file || !(file instanceof File)) {
    return c.json({ error: 'Missing file field' }, 400)
  }
  if (!(ALLOWED_BRANDING_TYPES as readonly string[]).includes(file.type)) {
    return c.json({ error: 'Unsupported file type' }, 400)
  }
  if (file.size > MAX_BRANDING_BYTES) {
    return c.json({ error: 'File exceeds 2 MB limit' }, 400)
  }

  const db = createDb(c.env.DB)

  // Delete old favicon R2 object so no orphan accumulates on re-upload
  const oldKeyRow = await db
    .select({ value: schema.storeConfig.value })
    .from(schema.storeConfig)
    .where(eq(schema.storeConfig.key, 'faviconR2Key'))
    .get()
  if (oldKeyRow?.value) {
    await c.env.R2.delete(oldKeyRow.value).catch(() => {})
  }

  const ext =
    file.type === 'image/svg+xml'
      ? 'svg'
      : file.type === 'image/jpeg'
        ? 'jpg'
        : file.type.split('/')[1]
  const r2Key = `branding/favicon-${nanoid()}.${ext}`

  await c.env.R2.put(r2Key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  })

  const faviconUrl = `${new URL(c.req.url).origin}/cdn/${r2Key}`
  const now = new Date().toISOString()

  for (const [key, value] of [
    ['faviconUrl', faviconUrl],
    ['faviconR2Key', r2Key],
  ] as const) {
    await db
      .insert(schema.storeConfig)
      .values({ key, value, updatedAt: now })
      .onConflictDoUpdate({ target: schema.storeConfig.key, set: { value, updatedAt: now } })
  }

  await bumpDataVersion(db)

  return c.json({ faviconUrl }, 201)
})

export default app
