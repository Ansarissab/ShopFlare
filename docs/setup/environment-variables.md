# Environment Variables

## CF Worker secrets (set via `wrangler secret put`)
Never committed to git. Set once per deployment.

| Variable | Description |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_live_...`) |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (served via /api/public-config) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (`whsec_...`) |
| `RESEND_API_KEY` | Resend API key (`re_...`) |
| `VAPID_PRIVATE_KEY` | Web Push private key |
| `VAPID_PUBLIC_KEY` | Web Push public key (served via /api/public-config) |
| `TURNSTILE_SITE_KEY` | CF Turnstile site key (served via /api/public-config) |
| `TURNSTILE_SECRET_KEY` | CF Turnstile secret key |

## Next.js env (`.env.local`)
Only non-sensitive values.

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_WORKER_URL` | Deployed CF Worker URL |

## Generate VAPID keys
```bash
npx web-push generate-vapid-keys
```
Copy both keys → `wrangler secret put` each one.

## Local development
Copy `.dev.vars.example` to `.dev.vars` and fill in test values.
Copy `.env.local.example` to `.env.local` and fill in.
Both files are gitignored.
