# Environment Variables

## CF Worker secrets (set via `wrangler secret put`)
Never committed to git. Set once per deployment.

| Variable | Description |
| --- | --- |
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_live_...`) |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (served via `/api/public-config`) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (`whsec_...`) |
| `RESEND_API_KEY` | Resend API key (`re_...`) |
| `VAPID_PRIVATE_KEY` | Web Push private key |
| `VAPID_PUBLIC_KEY` | Web Push public key (served via `/api/public-config`) |
| `TURNSTILE_SITE_KEY` | CF Turnstile site key (served via `/api/public-config`) |
| `TURNSTILE_SECRET_KEY` | CF Turnstile server secret — used to verify tokens server-side via siteverify |
| `FRONTEND_URL` | Cloudflare Pages origin (e.g. `https://yourstore.pages.dev`) — used for Stripe success/cancel redirect URLs and CORS |

## Next.js env (`.env.local`)
Only non-sensitive values. Never commit this file.

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_WORKER_URL` | Deployed CF Worker URL (e.g. `https://shopflare-worker.YOUR.workers.dev`) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | CF Turnstile site key — used to render the Turnstile widget on public forms |

> **Note:** `TURNSTILE_SITE_KEY` is also set as a Worker secret so it can be served via `GET /api/public-config`. The `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in `.env.local` is the same value but baked into the Next.js bundle at build time for the client widget.

## Generate VAPID keys
```bash
npx web-push generate-vapid-keys
```
Copy both keys → `wrangler secret put` each one.

## Local development
Copy `.dev.vars.example` to `.dev.vars` and fill in test values.
Copy `.env.local.example` to `.env.local` and fill in.
Both files are gitignored.
