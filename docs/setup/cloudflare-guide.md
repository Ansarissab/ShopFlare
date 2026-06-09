# Cloudflare Complete Setup Guide

Zero to live on Cloudflare. Two Workers, all on the **free plan** → $0 hosting.

**Architecture:** the storefront is a Next.js **SSR Worker** (`shopflare-web`, built
with `@opennextjs/cloudflare`) plus a Hono **API Worker** (`shopflare-worker`). It is
**not** Cloudflare Pages and **not** a static export. Admin is protected by an
**app-level password** (no Cloudflare Access, no Zero Trust, no account creation).

## Prerequisites

- Cloudflare account (free): <https://dash.cloudflare.com/sign-up>
- Stripe account (free): <https://dashboard.stripe.com/register>
- Resend account (free): <https://resend.com>
- A custom domain is **optional** (only needed for a branded URL or CF Access). The
  free `*.workers.dev` hosts work out of the box.

```bash
npx wrangler login
```

---

## Step 1 — Create D1 database

```bash
npx wrangler d1 create shopflare-db0
```

Copy the `database_id` into `wrangler.toml` (keep binding `DB`):

```toml
[[d1_databases]]
binding = "DB"
database_name = "shopflare-db0"
database_id = "PASTE_HERE"
```

## Step 2 — Create KV namespace

```bash
npx wrangler kv namespace create KV
```

Copy the `id` into `wrangler.toml` (keep binding `KV`).

## Step 3 — Create R2 bucket

> **R2 requires a payment method on file** (Cloudflare policy), but stays **$0**
> under the free tier: 10 GB storage, egress free. Adding the card does not start
> billing. This is the only Cloudflare product here that needs a card.

```bash
npx wrangler r2 bucket create shopflare-images0
```

Bucket name in `wrangler.toml` is enough (binding `R2`); no ID to paste.

## Step 4 — Migrate + seed the remote database

```bash
pnpm db:migrate   # apply migrations to remote D1
pnpm db:seed      # seed store_config defaults (INSERT OR IGNORE, safe to re-run)
```

(Use `pnpm db:migrate:local` / `pnpm db:seed:local` for local dev.)

## Step 5 — Set API worker secrets

```bash
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_PUBLISHABLE_KEY
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put VAPID_PRIVATE_KEY     # npx web-push generate-vapid-keys
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put TURNSTILE_SITE_KEY
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler secret put ADMIN_PASSWORD        # your admin password
npx wrangler secret put ADMIN_SESSION_SECRET  # openssl rand -hex 32
```

`STRIPE_WEBHOOK_SECRET` and `FRONTEND_URL` are set later (Steps 9 + 10) — they
depend on URLs that don't exist yet.

> **Admin auth:** `ADMIN_PASSWORD` is the only credential — there is no signup or
> account creation. Rotate it any time with `wrangler secret put ADMIN_PASSWORD`
> (takes effect immediately, no redeploy). Rotating `ADMIN_SESSION_SECRET` logs out
> every existing session.

## Step 6 — Deploy the API worker

```bash
pnpm worker:deploy
```

Copy the printed URL, e.g. `https://shopflare-worker.YOUR.workers.dev`.

## Step 7 — Configure the frontend build env

`NEXT_PUBLIC_*` values are baked into the bundle **at build time**, so set them in
`.env.local` **before** deploying the frontend:

```bash
NEXT_PUBLIC_WORKER_URL=https://shopflare-worker.YOUR.workers.dev
NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAAAAA_your_site_key
NEXT_PUBLIC_SITE_URL=https://shopflare-web.YOUR.workers.dev   # update after Step 8 if unknown
```

## Step 8 — Deploy the frontend (storefront) worker

```bash
pnpm web:deploy        # opennextjs-cloudflare build && deploy (uses wrangler.frontend.jsonc)
```

Copy the printed URL, e.g. `https://shopflare-web.YOUR.workers.dev`. If you guessed
`NEXT_PUBLIC_SITE_URL` wrong in Step 7, fix it and re-run `pnpm web:deploy` (it's
compiled in).

## Step 9 — Point the API worker at the frontend (CORS + Stripe redirects)

```bash
npx wrangler secret put FRONTEND_URL   # paste https://shopflare-web.YOUR.workers.dev
pnpm worker:deploy                     # redeploy so it takes effect
```

## Step 10 — Stripe webhook

1. Stripe Dashboard → Developers → Webhooks → Add endpoint
2. URL: `https://shopflare-worker.YOUR.workers.dev/api/stripe/webhook`
3. Events: `checkout.session.completed`, `checkout.session.expired`, `payment_intent.payment_failed`
4. Copy the signing secret:

```bash
npx wrangler secret put STRIPE_WEBHOOK_SECRET
```

## Step 11 — Keep it $0: budget alerts

Cloudflare Dashboard → **Manage Account → Billing → Billable Usage** → **Set Budget
Alert** → threshold (e.g. **$1**) → **Create**. Stay on the **Workers free plan**
(over-limit = HTTP 429, never billed). See `docs/architecture/cost-breakdown-normal.md`.

## Step 12 — AI-scraper audit (post-deploy, required for LLM discovery)

Even a perfect `robots.txt` is moot if Cloudflare's edge 403s the UAs first.

**Check these two settings in the CF dashboard for both Workers:**

1. **Security → Bots → "Block AI Scrapers & Crawlers"** managed toggle — if ON, it
   silently blocks GPTBot, Bytespider, and others, overriding your `robots.txt`.
2. **Security → WAF → Bot Fight Mode** — same risk; managed rules can catch search/answer
   bots you want to allow.

Decide per your `aiTrainingAllowed` choice:

- **Allow AI training:** ensure "Block AI Scrapers & Crawlers" is **OFF** (or scoped to
  exclude the search/answer UAs in `AI_SEARCH_BOTS`).
- **Block training only:** keep the CF toggle OFF, rely on `robots.txt` — it's a
  directive, not a hard block, but avoids the edge blocking the bots you do want.

**Verify after deploy:**

```bash
# Search/answer bots — must return 200, never 403 or challenge
curl -sI -A "OAI-SearchBot"    https://{your-store}/
curl -sI -A "PerplexityBot"    https://{your-store}/llms.txt
curl -sI -A "Claude-SearchBot" https://{your-store}/product/{slug}

# llms.txt must serve text/plain
curl -s https://{your-store}/llms.txt | head -5

# robots.txt must be dynamic (shows AI stanzas when llmDiscoveryEnabled=true)
curl -s https://{your-store}/robots.txt
```

All search-bot requests should return `HTTP 200`. If you see `403` or a Cloudflare
challenge page, the managed AI-scraper block is intercepting before your app.

---

## Step 13 — Custom domain (optional)

Add a domain you own to Cloudflare (as a zone), then map both workers to subdomains
(Workers & Pages → each worker → Settings → Domains & Routes), e.g.
`store.yourdomain.com` (frontend) + `api.yourdomain.com` (API). Update
`NEXT_PUBLIC_WORKER_URL`, `NEXT_PUBLIC_SITE_URL`, and `FRONTEND_URL` accordingly and
redeploy. A custom domain is also what would let you use Cloudflare Access for admin
(path-scoped) instead of the app-level password — `*.workers.dev` can't do that.

---

## Done

- Store: `https://shopflare-web.YOUR.workers.dev`
- Admin: `https://shopflare-web.YOUR.workers.dev/admin` → redirects to `/admin/login`
  → enter `ADMIN_PASSWORD`.

**Setup time: ~15 minutes. Monthly cost: $0.**

---

## Uptime monitoring (optional, recommended)

Set up an external monitor that polls `GET /healthz` on the API worker every 3 minutes.
See [status-monitoring.md](status-monitoring.md) for the full Better Stack free-tier setup
(monitor + hosted status page + alert contacts).
