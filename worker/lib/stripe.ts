import Stripe from 'stripe'

/**
 * Factory: creates a Stripe client from the env secret key.
 * CF Workers are stateless — no global singletons; call once per request.
 */
export function createStripe(secretKey: string): Stripe {
  return new Stripe(secretKey, { apiVersion: '2026-05-27.dahlia' })
}

/** Shape of checkout request body after validation */
export interface CheckoutItem {
  stripePriceId: string
  quantity: number
}

export interface CheckoutRequestBody {
  items: CheckoutItem[]
  orderId: string
  couponCode?: string
}
