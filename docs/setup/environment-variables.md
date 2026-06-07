# Environment Variables

> Admin auth uses an **app-level password** (a session token signed in the API
> worker), not Cloudflare Access. See `docs/setup/cloudflare-guide.md`.

## API worker secrets (`shopflare-worker`) — `wrangler secret put`
Never committed to git. Set once per deployment; rotate any time (read fresh per
request, no redeploy needed).

| Variable | Description |
| --- | --- |
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_live_...`) |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (served via `/api/public-config`) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (`whsec_...`) |
| `RESEND_API_KEY` | Resend API key (`re_...`) |
| `VAPID_PRIVATE_KEY` | Web Push private key |
| `VAPID_PUBLIC_KEY` | Web Push public key (served via `/api/public-config`) |
| `TURNSTILE_SITE_KEY` | CF Turnstile site key (served via `/api/public-config`) |
| `TURNSTILE_SECRET_KEY` | CF Turnstile server secret — verifies tokens via siteverify |
| `FRONTEND_URL` | Frontend worker origin (e.g. `https://shopflare-web.YOUR.workers.dev`) — Stripe success/cancel redirects + CORS allow-list |
| `ADMIN_PASSWORD` | The merchant's admin password. Login compares against it (constant-time). Rotate: `wrangler secret put ADMIN_PASSWORD`. |
| `ADMIN_SESSION_SECRET` | HMAC key signing admin session tokens. Generate with `openssl rand -hex 32`. **Rotating it logs everyone out.** |

## Frontend build-time vars (`.env.local`, baked by `pnpm web:deploy`)
`NEXT_PUBLIC_*` values are inlined into the client bundle **at build time** — they
must be present in `.env.local` *before* you run `pnpm web:deploy`. The frontend
worker (`shopflare-web`) needs **no runtime secrets** (admin auth is enforced by
the API worker; the UI gate is client-side).

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_WORKER_URL` | Deployed API worker URL (e.g. `https://shopflare-worker.YOUR.workers.dev`) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | CF Turnstile site key — baked in for the Turnstile widget |
| `NEXT_PUBLIC_SITE_URL` | Public site URL (frontend worker origin) — used by `sitemap.ts` |

> Changed a `NEXT_PUBLIC_*` value? You must **rebuild + redeploy** the frontend
> (`pnpm web:deploy`) — it's compiled in, not read at runtime.

## Local development
Never committed to git. Both files are gitignored.

`.dev.vars` (local API worker, `wrangler dev`):

| Variable | Description |
| --- | --- |
| `STRIPE_*`, `RESEND_API_KEY`, `VAPID_*`, `TURNSTILE_*` | Test values |
| `ENVIRONMENT` | `development` — enables the admin dev bypass |
| `ADMIN_DEV_BYPASS` | `1` together with `ENVIRONMENT=development` skips the admin token check locally. **Never set in production.** |
| `ADMIN_PASSWORD` / `ADMIN_SESSION_SECRET` | Optional locally (the dev bypass skips the check); set them to exercise the real login flow |

`.env.local` (Next.js dev): `NEXT_PUBLIC_WORKER_URL=http://localhost:8787`,
`NEXT_PUBLIC_TURNSTILE_SITE_KEY` (test key), `NEXT_PUBLIC_SITE_URL`.

> **Local admin bypass:** Both `ENVIRONMENT=development` *and* `ADMIN_DEV_BYPASS=1`
> are required together — neither alone is sufficient. Never set in production
> (the deploy forces `ENVIRONMENT=production`).

## Generate keys
```bash
npx web-push generate-vapid-keys     # VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY
openssl rand -hex 32                 # ADMIN_SESSION_SECRET
```

## Bootstrap
Copy `.dev.vars.example` → `.dev.vars` and `.env.local.example` → `.env.local`, fill in.
