// Admin product routes — mounted under /api/admin/products, behind requireAccess.
// Full CRUD for products, variants, size options, and R2 images. The public
// /api/products router only exposes read-only active-product listings.

import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { createDb } from 'worker/db/index'
import * as schema from 'worker/db/schema'
import { assembleProduct, assembleProductList } from 'worker/lib/products'
import { parseBody } from 'worker/lib/http'
import {
  createProductSchema,
  updateProductSchema,
  createVariantSchema,
  updateVariantSchema,
  createSizeOptionSchema,
  updateSizeOptionSchema,
} from '@/lib/schemas'
import { MAX_IMAGES_PER_VARIANT, MAX_IMAGE_BYTES, ALLOWED_IMAGE_TYPES } from '@/lib/constants'
import type { AdminEnv } from 'worker/lib/access'
import { dispatchRestockAlerts } from 'worker/lib/notify'
import { bumpDataVersion } from 'worker/lib/version'

const app = new Hono<AdminEnv>()

// ─── GET / — list ALL products (incl. inactive/soft-deleted) ─────────────────

app.get('/', async (c) => {
  const db = createDb(c.env.DB)
  const products = await assembleProductList(db, { includeInactive: true })
  return c.json({ products })
})

// ─── GET /:id — single product (incl. inactive, so it can be re-activated) ───

app.get('/:id', async (c) => {
  const { id } = c.req.param()
  const db = createDb(c.env.DB)

  const product = await db
    .select()
    .from(schema.products)
    .where(eq(schema.products.id, id))
    .get()

  if (!product) return c.json({ error: 'Product not found' }, 404)

  const assembled = await assembleProduct(db, product)
  return c.json(assembled)
})

// ─── POST / — create product ─────────────────────────────────────────────────

app.post('/', async (c) => {
  const [body, errResp] = await parseBody(c)
  if (errResp) return errResp

  const parsed = createProductSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 400)
  }

  const db = createDb(c.env.DB)
  const id = nanoid()
  const now = new Date().toISOString()

  await db.insert(schema.products).values({
    id,
    name: parsed.data.name,
    description: parsed.data.description,
    active: parsed.data.active,
    stripeProductId: parsed.data.stripeProductId ?? null,
    createdAt: now,
    updatedAt: now,
  })

  const [product] = await Promise.all([
    db.select().from(schema.products).where(eq(schema.products.id, id)).get(),
    bumpDataVersion(db),
  ])
  return c.json(product, 201)
})

// ─── PUT /:id — update product ────────────────────────────────────────────────

app.put('/:id', async (c) => {
  const { id } = c.req.param()
  const [body, errResp] = await parseBody(c)
  if (errResp) return errResp

  const parsed = updateProductSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 400)
  }

  const db = createDb(c.env.DB)
  const product = await db
    .select({ id: schema.products.id })
    .from(schema.products)
    .where(eq(schema.products.id, id))
    .get()
  if (!product) return c.json({ error: 'Product not found' }, 404)

  const { name, description, active, stripeProductId } = parsed.data
  await db
    .update(schema.products)
    .set({
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(active !== undefined ? { active } : {}),
      ...(stripeProductId !== undefined ? { stripeProductId } : {}),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.products.id, id))

  const [updated] = await Promise.all([
    db.select().from(schema.products).where(eq(schema.products.id, id)).get(),
    bumpDataVersion(db),
  ])
  return c.json(updated)
})

// ─── DELETE /:id — soft-delete product ────────────────────────────────────────

app.delete('/:id', async (c) => {
  const { id } = c.req.param()
  const db = createDb(c.env.DB)

  const product = await db
    .select({ id: schema.products.id })
    .from(schema.products)
    .where(eq(schema.products.id, id))
    .get()
  if (!product) return c.json({ error: 'Product not found' }, 404)

  await db
    .update(schema.products)
    .set({ active: false, updatedAt: new Date().toISOString() })
    .where(eq(schema.products.id, id))

  await bumpDataVersion(db)
  return c.json({ ok: true })
})

// ─── POST /variants — add variant ─────────────────────────────────────────────

app.post('/variants', async (c) => {
  const [body, errResp] = await parseBody(c)
  if (errResp) return errResp

  const parsed = createVariantSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 400)
  }

  const db = createDb(c.env.DB)
  const product = await db
    .select({ id: schema.products.id })
    .from(schema.products)
    .where(eq(schema.products.id, parsed.data.productId))
    .get()
  if (!product) return c.json({ error: 'Product not found' }, 404)

  const id = nanoid()
  await db.insert(schema.variants).values({
    id,
    productId: parsed.data.productId,
    label: parsed.data.label,
    colorHex: parsed.data.colorHex ?? null,
    sortOrder: parsed.data.sortOrder,
  })

  const [variant] = await Promise.all([
    db.select().from(schema.variants).where(eq(schema.variants.id, id)).get(),
    bumpDataVersion(db),
  ])
  return c.json(variant, 201)
})

// ─── PUT /variants/:variantId — update variant ───────────────────────────────

app.put('/variants/:variantId', async (c) => {
  const { variantId } = c.req.param()
  const [body, errResp] = await parseBody(c)
  if (errResp) return errResp

  const parsed = updateVariantSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 400)
  }

  const db = createDb(c.env.DB)
  const variant = await db
    .select({ id: schema.variants.id })
    .from(schema.variants)
    .where(eq(schema.variants.id, variantId))
    .get()
  if (!variant) return c.json({ error: 'Variant not found' }, 404)

  const { label, colorHex, sortOrder } = parsed.data
  await db
    .update(schema.variants)
    .set({
      ...(label !== undefined ? { label } : {}),
      ...(colorHex !== undefined ? { colorHex } : {}),
      ...(sortOrder !== undefined ? { sortOrder } : {}),
    })
    .where(eq(schema.variants.id, variantId))

  const [updated] = await Promise.all([
    db.select().from(schema.variants).where(eq(schema.variants.id, variantId)).get(),
    bumpDataVersion(db),
  ])
  return c.json(updated)
})

// ─── DELETE /variants/:variantId — delete variant (cascade) ──────────────────

app.delete('/variants/:variantId', async (c) => {
  const { variantId } = c.req.param()
  const db = createDb(c.env.DB)

  const variant = await db
    .select({ id: schema.variants.id })
    .from(schema.variants)
    .where(eq(schema.variants.id, variantId))
    .get()
  if (!variant) return c.json({ error: 'Variant not found' }, 404)

  // Delete R2 images before deleting DB rows (cascade handles productImages rows).
  const images = await db
    .select({ r2Key: schema.productImages.r2Key })
    .from(schema.productImages)
    .where(eq(schema.productImages.variantId, variantId))
    .all()

  await Promise.all(images.map((img) => c.env.R2.delete(img.r2Key)))
  await db.delete(schema.variants).where(eq(schema.variants.id, variantId))

  await bumpDataVersion(db)
  return c.json({ ok: true })
})

// ─── POST /sizes — add size option ────────────────────────────────────────────

app.post('/sizes', async (c) => {
  const [body, errResp] = await parseBody(c)
  if (errResp) return errResp

  const parsed = createSizeOptionSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 400)
  }

  const db = createDb(c.env.DB)
  const variant = await db
    .select({ id: schema.variants.id })
    .from(schema.variants)
    .where(eq(schema.variants.id, parsed.data.variantId))
    .get()
  if (!variant) return c.json({ error: 'Variant not found' }, 404)

  const id = nanoid()
  await db.insert(schema.sizeOptions).values({
    id,
    variantId: parsed.data.variantId,
    size: parsed.data.size,
    sku: parsed.data.sku ?? null,
    priceCents: parsed.data.priceCents,
    stock: parsed.data.stock,
    stripePriceId: parsed.data.stripePriceId ?? null,
    active: parsed.data.active,
  })

  const [sizeOption] = await Promise.all([
    db.select().from(schema.sizeOptions).where(eq(schema.sizeOptions.id, id)).get(),
    bumpDataVersion(db),
  ])
  return c.json(sizeOption, 201)
})

// ─── PUT /sizes/:sizeId — update size option ─────────────────────────────────

app.put('/sizes/:sizeId', async (c) => {
  const { sizeId } = c.req.param()
  const [body, errResp] = await parseBody(c)
  if (errResp) return errResp

  const parsed = updateSizeOptionSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 400)
  }

  const db = createDb(c.env.DB)

  // Read current stock BEFORE update so we can detect a restock transition.
  const current = await db
    .select({ id: schema.sizeOptions.id, stock: schema.sizeOptions.stock })
    .from(schema.sizeOptions)
    .where(eq(schema.sizeOptions.id, sizeId))
    .get()
  if (!current) return c.json({ error: 'Size option not found' }, 404)

  const oldStock = current.stock

  const { size, sku, priceCents, stock, stripePriceId, active } = parsed.data
  await db
    .update(schema.sizeOptions)
    .set({
      ...(size !== undefined ? { size } : {}),
      ...(sku !== undefined ? { sku } : {}),
      ...(priceCents !== undefined ? { priceCents } : {}),
      ...(stock !== undefined ? { stock } : {}),
      ...(stripePriceId !== undefined ? { stripePriceId } : {}),
      ...(active !== undefined ? { active } : {}),
    })
    .where(eq(schema.sizeOptions.id, sizeId))

  const updated = await db
    .select()
    .from(schema.sizeOptions)
    .where(eq(schema.sizeOptions.id, sizeId))
    .get()

  // ── Restock-alert dispatch ─────────────────────────────────────────────────
  // Trigger only when old stock was 0 (OOS) and the new stock is available
  // (>0 or -1 unlimited). Use waitUntil so dispatch never blocks the response.
  const newStock = updated?.stock ?? oldStock
  const wasOOS      = oldStock === 0
  const nowAvailable = newStock > 0 || newStock === -1
  if (wasOOS && nowAvailable) {
    try {
      c.executionCtx.waitUntil(
        dispatchRestockAlerts(db, c.env, sizeId),
      )
    } catch (err) {
      // Defensive: executionCtx.waitUntil should never throw synchronously,
      // but guard so the PUT response is never affected.
      console.error('restock dispatch schedule error', err)
    }
  }

  await bumpDataVersion(db)
  return c.json(updated)
})

// ─── DELETE /sizes/:sizeId — delete size option ──────────────────────────────

app.delete('/sizes/:sizeId', async (c) => {
  const { sizeId } = c.req.param()
  const db = createDb(c.env.DB)

  const sizeOption = await db
    .select({ id: schema.sizeOptions.id })
    .from(schema.sizeOptions)
    .where(eq(schema.sizeOptions.id, sizeId))
    .get()
  if (!sizeOption) return c.json({ error: 'Size option not found' }, 404)

  await db.delete(schema.sizeOptions).where(eq(schema.sizeOptions.id, sizeId))
  await bumpDataVersion(db)
  return c.json({ ok: true })
})

// ─── POST /images/upload — upload image to R2 (multipart) ────────────────────
// FormData: file (Blob), variantId (string), sortOrder (number)

app.post('/images/upload', async (c) => {
  const formData = await c.req.formData()

  const file = formData.get('file') as File | null
  const variantId = formData.get('variantId') as string | null
  const sortOrderRaw = formData.get('sortOrder') as string | null
  const sortOrder = sortOrderRaw !== null ? Number(sortOrderRaw) : 0

  if (!file || !variantId) {
    return c.json({ error: 'file and variantId are required' }, 400)
  }

  // Server-side validation — never trust the client compression step.
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return c.json({ error: `Unsupported image type: ${file.type || 'unknown'}` }, 415)
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return c.json({ error: `Image exceeds ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB limit` }, 413)
  }

  const db = createDb(c.env.DB)
  const variant = await db
    .select({ id: schema.variants.id, productId: schema.variants.productId })
    .from(schema.variants)
    .where(eq(schema.variants.id, variantId))
    .get()
  if (!variant) return c.json({ error: 'Variant not found' }, 404)

  const existing = await db
    .select({ id: schema.productImages.id })
    .from(schema.productImages)
    .where(eq(schema.productImages.variantId, variantId))
    .all()
  if (existing.length >= MAX_IMAGES_PER_VARIANT) {
    return c.json({ error: `Maximum ${MAX_IMAGES_PER_VARIANT} images per variant` }, 422)
  }

  // Extension derived from the validated MIME type (not the client filename).
  const ext = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1] ?? 'jpg'
  const imageId = nanoid()
  const r2Key = `products/${variant.productId}/${variantId}/${imageId}.${ext}`

  await c.env.R2.put(r2Key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  })

  // Public URL is served by the Worker's own /cdn/* route (this same origin),
  // so it resolves regardless of how FRONTEND_URL/Pages is configured.
  const url = `${new URL(c.req.url).origin}/cdn/${r2Key}`

  await db.insert(schema.productImages).values({ id: imageId, variantId, url, r2Key, sortOrder })

  const [image] = await Promise.all([
    db.select().from(schema.productImages).where(eq(schema.productImages.id, imageId)).get(),
    bumpDataVersion(db),
  ])
  return c.json(image, 201)
})

// ─── DELETE /images/:imageId — delete image ──────────────────────────────────

app.delete('/images/:imageId', async (c) => {
  const { imageId } = c.req.param()
  const db = createDb(c.env.DB)

  const image = await db
    .select()
    .from(schema.productImages)
    .where(eq(schema.productImages.id, imageId))
    .get()
  if (!image) return c.json({ error: 'Image not found' }, 404)

  await c.env.R2.delete(image.r2Key)
  await db.delete(schema.productImages).where(eq(schema.productImages.id, imageId))

  await bumpDataVersion(db)
  return c.json({ ok: true })
})

export default app
