// Atomic field primitives — compose these into domain schemas.
// Never use z.string().email() raw; use these named fields everywhere.
import { z } from 'zod/v4'

export const idField       = z.string().min(1)
export const quantityField = z.number().int().positive().max(999)
export const emailField    = z.string().email()
export const phoneField    = z.string().min(7)
export const couponField   = z.string().optional()

// Reusable cart line item (COD and Stripe share this shape, different ID key)
export const orderItemSchema = z.object({
  sizeOptionId: idField,
  quantity: quantityField,
})

// Base contact block — extended by shippingAddressSchema and notifyMeSchema
export const contactSchema = z.object({
  email: emailField.optional(),
  phone: phoneField.optional(),
})

export type OrderItem = z.infer<typeof orderItemSchema>
