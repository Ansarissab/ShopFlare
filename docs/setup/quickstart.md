# Quickstart

Get your store live in 15 minutes.

## Prerequisites

- Node 22+ + pnpm (via mise: `.tool-versions` included)
- Cloudflare account (free): <https://dash.cloudflare.com>
- Stripe account (free): <https://dashboard.stripe.com>
- Resend account (free): <https://resend.com>

## Steps

### 1. Fork the repo

Click **Fork** on GitHub. This gives you your own copy to customize.

### 2. Install dependencies

```bash
pnpm install
```

### 3. Run the setup wizard

```bash
pnpm setup
```

The wizard handles everything interactively:

- Cloudflare login
- R2 bucket creation
- DB migrations + seed
- Worker secrets (Stripe, Resend, Turnstile, admin password)
- API worker deploy (auto-provisions D1 + KV on first deploy)
- Stripe webhook auto-create
- Frontend worker deploy
- `.env.local` generation
- Post-deploy smoke check

### 4. Set up the local database

```bash
pnpm db:migrate:local   # apply D1 migrations locally
pnpm db:seed:local      # seed store_config defaults
```

### 5. Start local dev

```bash
pnpm dev          # Next.js on localhost:3000
pnpm worker:dev   # CF Worker on localhost:8787
```

### 6. Deploy (after setup wizard)

If you need to redeploy later:

```bash
pnpm worker:deploy   # API Worker (shopflare-worker)
pnpm web:deploy      # Frontend Worker (shopflare-web, OpenNext SSR — not Pages)
```

See [cloudflare-guide.md](cloudflare-guide.md) for full manual steps and the
maintainer override for keeping real resource ids local.
