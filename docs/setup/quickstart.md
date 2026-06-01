# Quickstart

Get your store live in 15 minutes.

## Prerequisites

- Node 24 + pnpm (via mise: `.tool-versions` included)
- Cloudflare account (free): <https://dash.cloudflare.com>
- Stripe account (free): <https://dashboard.stripe.com>
- Resend account (free): <https://resend.com>
- GitHub account (for deployment)

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

The wizard walks you through every step interactively.

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

### 6. Deploy

```bash
git push origin main   # Triggers Cloudflare Pages auto-deploy
pnpm worker:deploy     # Deploy CF Worker
```

See [cloudflare-guide.md](cloudflare-guide.md) for detailed CF setup steps.
