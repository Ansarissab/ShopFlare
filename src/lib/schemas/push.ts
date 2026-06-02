// Web Push schemas — shared by the admin push routes (worker/routes/push.ts).
// Replaces the hand-rolled typeof checks so push input is validated the same
// (Zod) way as every other route (DRY rule 4).
import { z } from 'zod/v4'

// Browser PushSubscription → the subset the worker persists.
export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  auth:     z.string().min(1).max(256),
  p256dh:   z.string().min(1).max(256),
})

// Unsubscribe — endpoint only (project from the subscription schema).
export const pushUnsubscribeSchema = pushSubscriptionSchema.pick({ endpoint: true })

// Admin /send trigger. All fields optional — an empty body sends a generic
// "new order" tickle (the route fills the default title). `url` is constrained
// to a relative same-origin path so a pushed notification can never be turned
// into an open redirect / off-site link.
export const pushSendSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  body:  z.string().max(500).optional(),
  url:   z.string().regex(/^\/[^\s]*$/, 'must be a relative path').max(512).optional(),
})

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>
export type PushUnsubscribeInput  = z.infer<typeof pushUnsubscribeSchema>
export type PushSendInput         = z.infer<typeof pushSendSchema>
