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

  // App-level admin auth (see worker/lib/access.ts + admin-session.ts).
  // ADMIN_PASSWORD: the merchant's admin password (rotate via `wrangler secret
  //   put ADMIN_PASSWORD`; read fresh per request, no redeploy needed).
  // ADMIN_SESSION_SECRET: HMAC key for signing session tokens. Rotating it
  //   immediately invalidates every issued token.
  // Both required in production; when unset the admin API fails closed (503).
  ADMIN_PASSWORD?: string
  ADMIN_SESSION_SECRET?: string
  ENVIRONMENT?: string
  // Must be '1' together with ENVIRONMENT=development to bypass auth locally.
  ADMIN_DEV_BYPASS?: string

  // Deployment
  FRONTEND_URL: string
}
