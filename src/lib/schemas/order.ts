// Order schemas — composed from base primitives via .extend() and .merge()
import { z } from 'zod/v4'
import { idField, quantityField, couponField, orderItemSchema, contactSchema } from './base'

// Shipping address — inherits contact fields, adds physical address
export const shippingAddressSchema = contactSchema.extend({
  name:       z.string().min(1),
  address:    z.string().min(5),
  city:       z.string().min(1),
  state:      z.string().optional(),
  postalCode: z.string().optional(),
  country:    z.string().length(2),
})

// COD order — composed from item list + shipping address
export const codOrderSchema = z.object({
  items:           z.array(orderItemSchema).min(1).max(50),
  shippingAddress: shippingAddressSchema,
  couponCode:      couponField,
})

// Stripe checkout — same quantity rules, different price ID key
const stripeItemSchema = z.object({
  stripePriceId: z.string().min(1),
  quantity:      quantityField,
})

export const createCheckoutSessionSchema = z.object({
  items:      z.array(stripeItemSchema).min(1).max(50),
  orderId:    idField,
  couponCode: couponField,
})

// Cancel request — optional reason field
export const cancelOrderSchema = z.object({
  reason: z.string().max(500).optional(),
})

export type ShippingAddress = z.infer<typeof shippingAddressSchema>
export type CodOrder        = z.infer<typeof codOrderSchema>
export type CancelOrder     = z.infer<typeof cancelOrderSchema>
