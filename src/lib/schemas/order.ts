// Order schemas — composed from base primitives via .extend() and .merge()
import { z } from 'zod/v4'
import { MAX_CART_ITEMS } from '@/lib/constants'
import { idField, baseItemSchema, couponField, orderItemSchema, contactSchema } from './base'

// Shipping address — inherits contact fields, adds physical address
export const shippingAddressSchema = contactSchema.extend({
  name:       z.string().min(1),
  address:    z.string().min(5),
  city:       z.string().min(1),
  state:      z.string().optional(),
  postalCode: z.string().min(2).max(12).optional(),
  country:    z.string().length(2),
})

// COD order — composed from item list + shipping address
export const codOrderSchema = z.object({
  items:           z.array(orderItemSchema).min(1).max(MAX_CART_ITEMS),
  shippingAddress: shippingAddressSchema,
  couponCode:      couponField,
})

// Stripe checkout — same quantity rules, different price ID key
const stripeItemSchema = baseItemSchema.extend({
  stripePriceId: z.string().min(1),
})

export const createCheckoutSessionSchema = z.object({
  items:      z.array(stripeItemSchema).min(1).max(MAX_CART_ITEMS),
  orderId:    idField,
  couponCode: couponField,
})

// Cancel request — optional reason field
export const cancelOrderSchema = z.object({
  reason: z.string().max(500).optional(),
})

export type ShippingAddress  = z.infer<typeof shippingAddressSchema>
export type CodOrder         = z.infer<typeof codOrderSchema>
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>
