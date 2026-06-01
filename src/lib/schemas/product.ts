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

// Public review submission — the customer supplies the human-facing orderNumber
// + contact (email/phone). The Worker resolves these to an order, verifies it is
// `delivered` and contains productId, then inserts a review with approved=false.
export const submitReviewSchema = z.object({
  orderNumber:  z.string().min(1).max(40),
  // min 4 chars: prevents a 1-2 digit `contact` from matching any order via the
  // phone digits-suffix check in the Worker (see worker/routes/reviews.ts).
  contact:      z.string().min(4).max(160),
  productId:    idField,
  customerName: z.string().min(1).max(120),
  rating:       z.number().int().min(1).max(5),
  body:         z.string().max(1000).optional(),
})

// Admin moderation — approve / unapprove a review.
export const moderateReviewSchema = z.object({
  approved: z.boolean(),
})

// Notify Me base — extend first so we can .pick() from it
const notifyMeBase = contactSchema.extend({ sizeOptionId: idField })

// Full schema with server-side refinement (email OR phone required)
export const notifyMeSchema = notifyMeBase.refine(
  d => d.email || d.phone,
  { message: 'Email or phone required' },
)

export type ReviewInput        = z.infer<typeof reviewSchema>
export type SubmitReviewInput  = z.infer<typeof submitReviewSchema>
export type ModerateReviewInput = z.infer<typeof moderateReviewSchema>
export type NotifyMeInput      = z.infer<typeof notifyMeSchema>
