# Cloudflare Complete Setup Guide

Everything you need to go from zero to live. Every step has exactly one action.

## Prerequisites

- Cloudflare account (free): https://dash.cloudflare.com/sign-up
- Stripe account (free): https://dashboard.stripe.com/register
- Resend account (free): https://resend.com

---

## Step 1 — Create D1 Database

```bash
npx wrangler d1 create store-db
```

Copy the `database_id` from output → paste into `wrangler.toml`:

```toml
[[d1_databases]]
database_id = "PASTE_HERE"
```

---

## Step 2 — Create KV Namespace

```bash
npx wrangler kv namespace create STORE_KV
```

Copy the `id` → paste into `wrangler.toml`:

```toml
[[kv_namespaces]]
id = "PASTE_HERE"
```

---

## Step 3 — Create R2 Bucket

```bash
npx wrangler r2 bucket create store-images
```

No ID needed — bucket name in wrangler.toml is sufficient.

---

## Step 4 — Run Database Migrations

```bash
pnpm db:generate
npx wrangler d1 execute store-db --file=worker/db/migrations/0000_initial.sql
```

---

## Step 5 — Set Worker Secrets

```bash
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put TURNSTILE_SECRET_KEY
```

Paste each value when prompted.

---

## Step 6 — Deploy Worker

```bash
pnpm worker:deploy
```

Copy the Worker URL → set in `.env.local`:

```
NEXT_PUBLIC_WORKER_URL=https://singlepage-ecomm-worker.YOUR.workers.dev
```

---

## Step 7 — Deploy to Cloudflare Pages

1. Push repo to GitHub
2. Go to Cloudflare Dashboard → Pages → Create Application
3. Connect GitHub → select your repo
4. Build settings:
   - Build command: `pnpm build`
   - Output directory: `out`
5. Click Deploy

---

## Step 8 — Set Up CF Access (Admin Protection)

1. Cloudflare Dashboard → Zero Trust → Access → Applications
2. Add Application → Self-hosted
3. Application domain: `yourdomain.com/admin*`
4. Policy: Allow → Email → your@email.com
5. Save

Admin at `/admin` now requires email OTP. No passwords to manage.

---

## Step 9 — Set Up Stripe Webhook

1. Stripe Dashboard → Developers → Webhooks → Add endpoint
2. URL: `https://YOUR-WORKER.workers.dev/api/stripe/webhook`
3. Events to listen:
   - `checkout.session.completed`
   - `payment_intent.payment_failed`
4. Copy signing secret → `npx wrangler secret put STRIPE_WEBHOOK_SECRET`

---

## Step 10 — Custom Domain (optional)

1. Cloudflare Pages → your project → Custom domains
2. Add your domain
3. DNS automatically configured

---

## Done!

Open `https://yoursite.pages.dev` — your store is live.
Open `https://yoursite.pages.dev/admin` — enter your email for OTP.

**Total setup time: ~15 minutes**
**Monthly cost: $0**
