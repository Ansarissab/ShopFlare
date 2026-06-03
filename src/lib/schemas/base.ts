// Atomic field primitives — compose these into domain schemas.
// Never use z.string().email() raw; use these named fields everywhere.
import { z } from 'zod/v4'
import { MIN_COUPON_CODE_LENGTH, MAX_COUPON_CODE_LENGTH } from '@/lib/constants'

export const idField       = z.string().min(1)
export const quantityField = z.number().int().positive().max(999)
export const emailField    = z.string().email()
export const phoneField    = z.string().regex(/^\+?[1-9]\d{6,14}$/)
export const couponField   = z
  .string()
  .min(MIN_COUPON_CODE_LENGTH)
  .max(MAX_COUPON_CODE_LENGTH)
  .regex(/^[A-Z0-9_-]+$/i)
  .optional()

// Base cart line item — quantity only; extended by order-domain item schemas
export const baseItemSchema = z.object({
  quantity: quantityField,
})

// Reusable cart line item (COD path) — base + sizeOptionId
export const orderItemSchema = baseItemSchema.extend({
  sizeOptionId: idField,
})

// Base contact block — extended by shippingAddressSchema and notifyMeSchema
export const contactSchema = z.object({
  email: emailField.optional(),
  phone: phoneField.optional(),
})

export type OrderItem = z.infer<typeof orderItemSchema>

export const hexColorField = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a 6-digit hex color (#rrggbb)')
