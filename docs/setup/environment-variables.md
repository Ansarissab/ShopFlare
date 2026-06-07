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

## Frontend build vars (`NEXT_PUBLIC_*`) — dev vs prod are SEPARATE files

`NEXT_PUBLIC_*` values are inlined into the client bundle **at build time**. To keep
local dev off production, they live in environment-specific files — **never put them
in `.env.local`** (which overrides everything and would leak the prod URL into `next dev`).

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_WORKER_URL` | API worker origin the client calls |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | CF Turnstile site key (widget) |
| `NEXT_PUBLIC_SITE_URL` | Public site URL — used by `sitemap.ts` |

- **`.env.development`** (committed, localhost only) → used by `next dev`. Pins the app
  to the local worker. No secrets.
- **`.env.production`** (gitignored; copy from `.env.production.example`) → baked by
  `pnpm web:deploy`. Holds the deployed URLs + real Turnstile site key.

> Changed a `NEXT_PUBLIC_*` value? **Rebuild + redeploy** (`pnpm web:deploy`) — it's
> compiled in, not read at runtime.

**Dev/prod isolation guard:** `lib/api.ts` refuses a non-localhost `NEXT_PUBLIC_WORKER_URL`
during `next dev` (falls back to `http://localhost:8787`) so local can never hit
production. To intentionally point dev at a remote/staging worker, set
`NEXT_PUBLIC_ALLOW_REMOTE_API=1`.

## Local development
The frontend worker (`shopflare-web`) needs **no runtime secrets** (admin auth is
enforced by the API worker; the UI gate is client-side). Local worker secrets go in
`.dev.vars` (gitignored):

| Variable | Description |
| --- | --- |
| `STRIPE_*`, `RESEND_API_KEY`, `VAPID_*`, `TURNSTILE_*` | Test values |
| `ENVIRONMENT` | `development` — enables the admin dev bypass |
| `ADMIN_DEV_BYPASS` | `1` together with `ENVIRONMENT=development` skips the admin token check locally. **Never set in production.** |
| `ADMIN_PASSWORD` / `ADMIN_SESSION_SECRET` | Optional locally (the dev bypass skips the check); set them to exercise the real login flow |

`next dev` reads `.env.development` (localhost) automatically — no `.env.local` needed.
`pnpm worker:dev` uses **local** D1/KV/R2 (miniflare); the integration suite is local too.
Only `pnpm db:migrate` / `db:seed` (the non-`:local` ones) touch remote D1, by design.

> **Turnstile is not used locally.** `verifyTurnstile` skips entirely when
> `ENVIRONMENT=development` (local `wrangler dev` + the integration suite), so you
> never need a real Turnstile token or secret locally — even if `.dev.vars` has one.
> It's enforced only in production (`ENVIRONMENT=production`). One bypass covers every
> public form + the admin login (DRY).

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
