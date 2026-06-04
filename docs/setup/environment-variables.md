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
| `CF_ACCESS_TEAM_DOMAIN` | CF Access team domain, e.g. `yourteam.cloudflareaccess.com` — for admin API JWT re-verification |
| `CF_ACCESS_AUD` | CF Access Audience (AUD) tag from the admin Access application |

## CF Pages environment variables (Cloudflare Dashboard → Pages → Settings → Variables)

Used by the Next.js app at build and runtime. Set in the Cloudflare Pages dashboard.

| Variable | Description |
| --- | --- |
| `CF_ACCESS_TEAM_DOMAIN` | Same value as the Worker secret — needed by the Next.js middleware to verify admin JWT |
| `CF_ACCESS_AUD` | Same value as the Worker secret — needed by the Next.js middleware |
| `NEXT_PUBLIC_WORKER_URL` | Deployed CF Worker URL (e.g. `https://shopflare-worker.YOUR.workers.dev`) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | CF Turnstile site key — baked into the client bundle for the Turnstile widget |

> **Why CF_ACCESS_TEAM_DOMAIN/AUD appear in both Worker and Pages?**
> The Worker verifies Access JWTs on the API (`/api/admin/*`) and the Next.js middleware
> verifies them on the UI (`/admin/*`). Both need the same credentials. Set them once in
> each environment.

## Next.js env (`.env.local`) — local development only
Never committed to git.

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_WORKER_URL` | Local wrangler dev URL, e.g. `http://localhost:8787` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Turnstile test site key (always passes in test mode) |
| `ENVIRONMENT` | Set to `development` to enable the admin dev bypass |
| `ADMIN_DEV_BYPASS` | Set to `1` together with `ENVIRONMENT=development` to skip CF Access JWT check locally. **Never set in production.** |

> **Local admin bypass:** Without a Cloudflare tunnel, the `Cf-Access-Jwt-Assertion` header is
> never injected, so the Next.js middleware and Worker admin middleware would block `/admin`.
> Both flags (`ENVIRONMENT=development` + `ADMIN_DEV_BYPASS=1`) are required together — neither
> alone is sufficient. They are never set in production deployments.

**Note:** `TURNSTILE_SITE_KEY` is also set as a Worker secret so it can be served via
`GET /api/public-config`. The `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in `.env.local` is the same
value but baked into the Next.js bundle at build time for the client widget.

## Generate VAPID keys
```bash
npx web-push generate-vapid-keys
```
Copy both keys → `wrangler secret put` each one.

## Local development
Copy `.dev.vars.example` to `.dev.vars` and fill in test values.
Copy `.env.local.example` to `.env.local` and fill in.
Both files are gitignored.
