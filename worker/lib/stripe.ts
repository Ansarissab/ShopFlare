import Stripe from 'stripe'

/**
 * Factory: creates a Stripe client from the env secret key.
 * CF Workers are stateless — no global singletons; call once per request.
 */
export function createStripe(secretKey: string): Stripe {
  return new Stripe(secretKey, { apiVersion: '2026-05-27.dahlia' })
}
