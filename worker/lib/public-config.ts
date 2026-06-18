// Builds the public (client-served) config object from the Worker env.
//
// Defense-in-depth: STRIPE_PUBLISHABLE_KEY must hold a *publishable* key (pk_*).
// If a Stripe SECRET key (sk_* / rk_*) is ever misconfigured into that slot, we
// must NEVER serve it publicly — blank it and log loudly instead. This is cheap
// insurance against the catastrophic case: the same misconfig with a live
// `sk_live_…` key would otherwise leak a live secret to anyone hitting
// /api/public-config. Pure + unit-tested (no Worker runtime needed).

export interface PublicConfig {
  stripePublishableKey: string
  turnstileSiteKey: string
  vapidPublicKey: string
}

/** Stripe secret keys: `sk_` (standard) / `rk_` (restricted). Publishable: `pk_`. */
const SECRET_KEY_RE = /^(sk|rk)_/

/** Returns the value only if it is NOT a Stripe secret-looking key; else '' (+ logs). */
export function publishableKeyOnly(value: string | undefined | null): string {
  const v = value ?? ''
  if (SECRET_KEY_RE.test(v)) {
    console.error(
      '[public-config] STRIPE_PUBLISHABLE_KEY looks like a SECRET key (sk_/rk_) — refusing to ' +
        'serve it publicly. Set the pk_ publishable key in your config.',
    )
    return ''
  }
  return v
}

export function buildPublicConfig(env: {
  STRIPE_PUBLISHABLE_KEY?: string
  TURNSTILE_SITE_KEY?: string
  VAPID_PUBLIC_KEY?: string
}): PublicConfig {
  return {
    stripePublishableKey: publishableKeyOnly(env.STRIPE_PUBLISHABLE_KEY),
    turnstileSiteKey: env.TURNSTILE_SITE_KEY ?? '',
    vapidPublicKey: env.VAPID_PUBLIC_KEY ?? '',
  }
}
