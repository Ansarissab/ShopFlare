import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { createDb } from '../db/index'
import * as schema from '../db/schema'
import { assembleProduct, assembleProductList } from '../lib/products'
import { parseBody } from '../lib/http'
import {
  createProductSchema,
  updateProductSchema,
  createVariantSchema,
  updateVariantSchema,
  createSizeOptionSchema,
  updateSizeOptionSchema,
} from '@/lib/schemas'
import { MAX_IMAGES_PER_VARIANT } from '@/lib/constants'
import type { Bindings } from '../types'

const app = new Hono<{ Bindings: Bindings }>()

// ─── GET / — list all active products with variants/images/sizes ──────────────

app.get('/', async (c) => {
  const db = createDb(c.env.DB)
  // Batched: 4 queries total regardless of catalogue size (see assembleProductList)
  const products = await assembleProductList(db)
  return c.json({ products })
})

// ─── GET /:id — single product by id ─────────────────────────────────────────

app.get('/:id', async (c) => {
  const { id } = c.req.param()
  const db = createDb(c.env.DB)

  const product = await db
    .select()
    .from(schema.products)
    .where(eq(schema.products.id, id))
    .get()

  if (!product || !product.active) {
    return c.json({ error: 'Product not found' }, 404)
  }

  const assembled = await assembleProduct(db, product)
  return c.json(assembled)
})

// ─── POST / — admin: create product ──────────────────────────────────────────

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

  const product = await db
    .select()
    .from(schema.products)
    .where(eq(schema.products.id, id))
    .get()

  return c.json(product, 201)
})

// ─── PUT /:id — admin: update product ────────────────────────────────────────

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

  const updated = await db
    .select()
    .from(schema.products)
    .where(eq(schema.products.id, id))
    .get()

  return c.json(updated)
})

// ─── DELETE /:id — admin: soft-delete product ─────────────────────────────────

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

  return c.json({ ok: true })
})

// ─── POST /variants — admin: add variant to product ───────────────────────────

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

  const variant = await db
    .select()
    .from(schema.variants)
    .where(eq(schema.variants.id, id))
    .get()

  return c.json(variant, 201)
})

// ─── PUT /variants/:variantId — admin: update variant ────────────────────────

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

  const updated = await db
    .select()
    .from(schema.variants)
    .where(eq(schema.variants.id, variantId))
    .get()

  return c.json(updated)
})

// ─── DELETE /variants/:variantId — admin: delete variant (cascade) ────────────

app.delete('/variants/:variantId', async (c) => {
  const { variantId } = c.req.param()
  const db = createDb(c.env.DB)

  const variant = await db
    .select({ id: schema.variants.id })
    .from(schema.variants)
    .where(eq(schema.variants.id, variantId))
    .get()

  if (!variant) return c.json({ error: 'Variant not found' }, 404)

  // Delete R2 images before deleting DB rows (cascade handles productImages D1 rows)
  const images = await db
    .select({ r2Key: schema.productImages.r2Key })
    .from(schema.productImages)
    .where(eq(schema.productImages.variantId, variantId))
    .all()

  await Promise.all(images.map((img) => c.env.R2.delete(img.r2Key)))

  await db.delete(schema.variants).where(eq(schema.variants.id, variantId))

  return c.json({ ok: true })
})

// ─── POST /sizes — admin: add size option ─────────────────────────────────────

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

  const sizeOption = await db
    .select()
    .from(schema.sizeOptions)
    .where(eq(schema.sizeOptions.id, id))
    .get()

  return c.json(sizeOption, 201)
})

// ─── PUT /sizes/:sizeId — admin: update size option ──────────────────────────

app.put('/sizes/:sizeId', async (c) => {
  const { sizeId } = c.req.param()
  const [body, errResp] = await parseBody(c)
  if (errResp) return errResp

  const parsed = updateSizeOptionSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 400)
  }

  const db = createDb(c.env.DB)
  const sizeOption = await db
    .select({ id: schema.sizeOptions.id })
    .from(schema.sizeOptions)
    .where(eq(schema.sizeOptions.id, sizeId))
    .get()

  if (!sizeOption) return c.json({ error: 'Size option not found' }, 404)

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

  return c.json(updated)
})

// ─── DELETE /sizes/:sizeId — admin: delete size option ───────────────────────

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

  return c.json({ ok: true })
})

// ─── POST /images/upload — admin: upload image to R2 (multipart) ─────────────
// Expects FormData: file (Blob), variantId (string), sortOrder (number)

app.post('/images/upload', async (c) => {
  const formData = await c.req.formData()

  const file = formData.get('file') as File | null
  const variantId = formData.get('variantId') as string | null
  const sortOrderRaw = formData.get('sortOrder') as string | null
  const sortOrder = sortOrderRaw !== null ? Number(sortOrderRaw) : 0

  if (!file || !variantId) {
    return c.json({ error: 'file and variantId are required' }, 400)
  }

  const db = createDb(c.env.DB)

  const variant = await db
    .select({ id: schema.variants.id, productId: schema.variants.productId })
    .from(schema.variants)
    .where(eq(schema.variants.id, variantId))
    .get()

  if (!variant) return c.json({ error: 'Variant not found' }, 404)

  // Enforce max images per variant
  const existingCount = await db
    .select({ id: schema.productImages.id })
    .from(schema.productImages)
    .where(eq(schema.productImages.variantId, variantId))
    .all()

  if (existingCount.length >= MAX_IMAGES_PER_VARIANT) {
    return c.json({ error: `Maximum ${MAX_IMAGES_PER_VARIANT} images per variant` }, 422)
  }

  const imageId = nanoid()
  const ext = file.name?.split('.').pop()?.toLowerCase() || 'jpg'
  const r2Key = `products/${variant.productId}/${variantId}/${imageId}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  await c.env.R2.put(r2Key, arrayBuffer, {
    httpMetadata: { contentType: file.type || 'image/jpeg' },
  })

  // Construct the public URL — R2 public bucket URL pattern
  const r2PublicUrl = c.env.FRONTEND_URL
    ? `${c.env.FRONTEND_URL}/cdn/${r2Key}`
    : `/${r2Key}`

  await db.insert(schema.productImages).values({
    id: imageId,
    variantId,
    url: r2PublicUrl,
    r2Key,
    sortOrder,
  })

  const image = await db
    .select()
    .from(schema.productImages)
    .where(eq(schema.productImages.id, imageId))
    .get()

  return c.json(image, 201)
})

// ─── DELETE /images/:imageId — admin: delete image ───────────────────────────

app.delete('/images/:imageId', async (c) => {
  const { imageId } = c.req.param()
  const db = createDb(c.env.DB)

  const image = await db
    .select()
    .from(schema.productImages)
    .where(eq(schema.productImages.id, imageId))
    .get()

  if (!image) return c.json({ error: 'Image not found' }, 404)

  // Delete from R2 then D1
  await c.env.R2.delete(image.r2Key)
  await db.delete(schema.productImages).where(eq(schema.productImages.id, imageId))

  return c.json({ ok: true })
})

export default app
