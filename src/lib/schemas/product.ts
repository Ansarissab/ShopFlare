// Product schemas — reviews and notify-me capture
import { z } from 'zod/v4'
import { idField, contactSchema } from './base'

// Review — verified purchase, rating 1-5
export const reviewSchema = z.object({
  orderId:      idField,
  productId:    idField,
  customerName: z.string().min(1),
  rating:       z.number().int().min(1).max(5),
  body:         z.string().max(1000).optional(),
})

// Notify Me base — extend first so we can .pick() from it
const notifyMeBase = contactSchema.extend({ sizeOptionId: idField })

// Full schema with server-side refinement (email OR phone required)
export const notifyMeSchema = notifyMeBase.refine(
  d => d.email || d.phone,
  { message: 'Email or phone required' },
)

export type ReviewInput   = z.infer<typeof reviewSchema>
export type NotifyMeInput = z.infer<typeof notifyMeSchema>
