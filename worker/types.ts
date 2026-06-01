// Canonical Cloudflare Worker environment bindings — single source of truth.
// Every route file imports this instead of declaring its own local `type Bindings`.

export type Bindings = {
  // Cloudflare platform bindings
  DB: D1Database
  KV: KVNamespace
  R2: R2Bucket

  // Stripe
  STRIPE_SECRET_KEY: string
  STRIPE_WEBHOOK_SECRET: string
  STRIPE_PUBLISHABLE_KEY: string

  // Resend (transactional email)
  RESEND_API_KEY: string

  // Web Push / VAPID
  VAPID_PRIVATE_KEY: string
  VAPID_PUBLIC_KEY: string

  // Cloudflare Turnstile
  TURNSTILE_SITE_KEY: string
}
