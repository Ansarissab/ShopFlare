// Admin-only schemas — product CRUD, variant/size management, order admin ops.
// All composed from lib/schemas primitives — never inline raw z fields.
import { z } from 'zod/v4'
import { idField } from './base'
import { storeConfigSchema } from './config'
import { ORDER_STATUSES } from '@/lib/constants'

// ─── Product ─────────────────────────────────────────────────────────────────

export const createProductSchema = z.object({
  name:        z.string().min(1).max(200),
  description: z.string().default(''),
  active:      z.boolean().default(true),
  stripeProductId: z.string().optional(),
})

export const updateProductSchema = createProductSchema.partial()

// ─── Variant ──────────────────────────────────────────────────────────────────

export const createVariantSchema = z.object({
  productId:  idField,
  label:      z.string().min(1).max(50),
  colorHex:   z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  sortOrder:  z.number().int().nonnegative().default(0),
})

export const updateVariantSchema = createVariantSchema.omit({ productId: true }).partial()

// ─── Size option ──────────────────────────────────────────────────────────────

export const createSizeOptionSchema = z.object({
  variantId:     idField,
  size:          z.string().min(1).max(20),
  sku:           z.string().max(50).optional(),
  priceCents:    z.number().int().positive(),
  stock:         z.number().int().min(-1).default(0),
  stripePriceId: z.string().optional(),
  active:        z.boolean().default(true),
})

export const updateSizeOptionSchema = createSizeOptionSchema.omit({ variantId: true }).partial()

// ─── Order admin ──────────────────────────────────────────────────────────────

const orderStatusEnum = z.enum(ORDER_STATUSES)

export const updateOrderStatusSchema = z.object({
  status: orderStatusEnum,
  notes:  z.string().max(500).optional(),
})

export const updateTrackingSchema = z.object({
  trackingNumber: z.string().min(1).max(100),
  carrier:        z.string().max(100).optional(),
})

// POS (point-of-sale) in-person order — admin-only. Prices/snapshots are
// resolved server-side from sizeOptionId, so the client sends only id + qty.
export const posOrderSchema = z.object({
  items: z.array(
    z.object({
      sizeOptionId: idField,
      quantity:     z.number().int().positive().max(999),
    }),
  ).min(1),
  customerPhone: z.string().optional(),
})

// ─── Config admin ─────────────────────────────────────────────────────────────

// Allow partial updates — merchant edits one section at a time
export const updateConfigSchema = storeConfigSchema.partial()

// ─── Type exports ─────────────────────────────────────────────────────────────

export type CreateProductInput     = z.infer<typeof createProductSchema>
export type UpdateProductInput     = z.infer<typeof updateProductSchema>
export type CreateVariantInput     = z.infer<typeof createVariantSchema>
export type UpdateVariantInput     = z.infer<typeof updateVariantSchema>
export type CreateSizeOptionInput  = z.infer<typeof createSizeOptionSchema>
export type UpdateSizeOptionInput  = z.infer<typeof updateSizeOptionSchema>
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>
export type UpdateTrackingInput    = z.infer<typeof updateTrackingSchema>
export type PosOrderInput          = z.infer<typeof posOrderSchema>
export type UpdateConfigInput      = z.infer<typeof updateConfigSchema>
