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
  // Verified sender address for outbound email. Falls back per email.ts:
  //   store_config.senderEmail → RESEND_FROM → onboarding@resend.dev (test only).
  RESEND_FROM?: string

  // Web Push / VAPID
  VAPID_PRIVATE_KEY: string
  VAPID_PUBLIC_KEY: string

  // Cloudflare Turnstile
  TURNSTILE_SITE_KEY: string
  TURNSTILE_SECRET_KEY: string

  // Cloudflare Access (admin API auth — defense-in-depth on top of edge Access).
  // CF_ACCESS_TEAM_DOMAIN: e.g. "myteam.cloudflareaccess.com" (no scheme).
  // CF_ACCESS_AUD: the Access application's Audience (AUD) tag.
  // When either is unset the middleware fails closed (403) in production but
  // allows requests in local `wrangler dev` (ENVIRONMENT=development).
  CF_ACCESS_TEAM_DOMAIN?: string
  CF_ACCESS_AUD?: string
  ENVIRONMENT?: string

  // Deployment
  FRONTEND_URL: string
}
