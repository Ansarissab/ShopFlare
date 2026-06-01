// Zod v4 — shared between client forms and CF Worker validation
import { z } from 'zod/v4'

export const shippingAddressSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(7),
  email: z.string().email().optional(),
  address: z.string().min(5),
  city: z.string().min(1),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().length(2),
})

export const codOrderSchema = z.object({
  items: z.array(z.object({
    sizeOptionId: z.string(),
    quantity: z.number().int().positive(),
  })).min(1),
  shippingAddress: shippingAddressSchema,
  couponCode: z.string().optional(),
})

export const createCheckoutSessionSchema = z.object({
  items: z.array(z.object({
    stripePriceId: z.string(),
    quantity: z.number().int().positive(),
  })).min(1),
  orderId: z.string(),
  couponCode: z.string().optional(),
})

export const reviewSchema = z.object({
  orderId: z.string(),
  productId: z.string(),
  customerName: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  body: z.string().max(1000).optional(),
})

export const notifyMeSchema = z.object({
  sizeOptionId: z.string(),
  email: z.string().email().optional(),
  phone: z.string().min(7).optional(),
}).refine(data => data.email || data.phone, {
  message: 'Email or phone required',
})

export type ShippingAddress = z.infer<typeof shippingAddressSchema>
export type CodOrder = z.infer<typeof codOrderSchema>
export type ReviewInput = z.infer<typeof reviewSchema>
export type NotifyMeInput = z.infer<typeof notifyMeSchema>
