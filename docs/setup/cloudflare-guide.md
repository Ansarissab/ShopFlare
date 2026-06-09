# Cloudflare Complete Setup Guide

Zero to live on Cloudflare. Two Workers, all on the **free plan** → $0 hosting.

**Architecture:** the storefront is a Next.js **SSR Worker** (`shopflare-web`, built
with `@opennextjs/cloudflare`) plus a Hono **API Worker** (`shopflare-worker`). It is
**not** Cloudflare Pages and **not** a static export. Admin is protected by an
**app-level password** (no Cloudflare Access, no Zero Trust, no account creation).

> **Recommended path:** run `pnpm setup` — the interactive wizard handles Steps 1–9
> automatically (D1/KV/R2 auto-provisioning, secrets, Stripe webhook, both worker
> deploys, smoke check). Use this guide for reference or manual recovery.

## Prerequisites

- Node 22+ + pnpm (via mise: `.tool-versions` included)
- Cloudflare account (free): <https://dash.cloudflare.com/sign-up>
- Stripe account (free): <https://dashboard.stripe.com/register>
- Resend account (free): <https://resend.com>
- A custom domain is **optional** (only needed for a branded URL). The
  free `*.workers.dev` hosts work out of the box.
- wrangler ≥ 4.45.0 (included in `devDependencies`; `pnpm install` is enough)

```bash
npx wrangler login
```

---

## Step 1 — Deploy the API worker (auto-provisions D1/KV/R2)

```bash
pnpm worker:deploy
```

`wrangler.toml` intentionally omits resource ids. On first deploy wrangler
auto-creates the D1 database (`shopflare-db0`), KV namespace, and links them to
the worker. R2 (`shopflare-images0`) must exist before deploy:

```bash
npx wrangler r2 bucket create shopflare-images0
```

> **R2 requires a payment method on file** (Cloudflare policy), but stays **$0**
> under the free tier: 10 GB storage, egress free. The card does not start billing.

Copy the printed API worker URL, e.g. `https://shopflare-worker.YOUR.workers.dev`.

---

## Step 2 — Migrate + seed the remote database

```bash
pnpm db:migrate   # apply migrations to remote D1
pnpm db:seed      # seed store_config defaults (INSERT OR IGNORE, safe to re-run)
```

(Use `pnpm db:migrate:local` / `pnpm db:seed:local` for local dev.)

---

## Step 3 — Set API worker secrets

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

`STRIPE_WEBHOOK_SECRET` is set in Step 5. `FRONTEND_URL` is set in Step 7.

> **Admin auth:** `ADMIN_PASSWORD` is the only credential — no signup or account
> creation. Rotate it any time with `wrangler secret put ADMIN_PASSWORD`
> (takes effect immediately, no redeploy). Rotating `ADMIN_SESSION_SECRET` logs out
> all existing sessions.

---

## Step 4 — Configure the frontend build env

`NEXT_PUBLIC_*` values are baked into the bundle **at build time**, so set them in
`.env.local` **before** deploying the frontend:

```bash
NEXT_PUBLIC_WORKER_URL=https://shopflare-worker.YOUR.workers.dev
NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAAAAA_your_site_key
NEXT_PUBLIC_SITE_URL=https://shopflare-web.YOUR.workers.dev   # update after Step 5 if unknown
```

---

## Step 5 — Deploy the frontend (storefront) worker

```bash
pnpm web:deploy        # opennextjs-cloudflare build && deploy (uses wrangler.frontend.jsonc)
```

Copy the printed URL, e.g. `https://shopflare-web.YOUR.workers.dev`. If you guessed
`NEXT_PUBLIC_SITE_URL` wrong in Step 4, fix it and re-run `pnpm web:deploy` (it's
compiled in).

---

## Step 6 — Stripe webhook

The `pnpm setup` wizard creates this automatically. For manual setup:

1. Stripe Dashboard → Developers → Webhooks → Add endpoint
2. URL: `https://shopflare-worker.YOUR.workers.dev/api/stripe/webhook`
3. Events: `checkout.session.completed`, `checkout.session.expired`,
   `payment_intent.payment_failed`
4. Copy the signing secret:

```bash
npx wrangler secret put STRIPE_WEBHOOK_SECRET
```

---

## Step 7 — Point the API worker at the frontend (CORS + Stripe redirects)

```bash
npx wrangler secret put FRONTEND_URL   # paste https://shopflare-web.YOUR.workers.dev
pnpm worker:deploy                     # redeploy so it takes effect
```

---

## Step 8 — Keep it $0: budget alerts

Cloudflare Dashboard → **Manage Account → Billing → Billable Usage** → **Set Budget
Alert** → threshold (e.g. **$1**) → **Create**. Stay on the **Workers free plan**
(over-limit = HTTP 429, never billed). See `docs/architecture/cost-breakdown-normal.md`.

---

## Step 9 — AI-scraper audit (post-deploy, required for LLM discovery)

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

## Step 10 — Custom domain (optional)

Add a domain you own to Cloudflare (as a zone), then map both workers to subdomains
(Workers → each worker → Settings → Domains & Routes), e.g.
`store.yourdomain.com` (frontend) + `api.yourdomain.com` (API). Update
`NEXT_PUBLIC_WORKER_URL`, `NEXT_PUBLIC_SITE_URL`, and `FRONTEND_URL` accordingly and
redeploy.

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

---

## Maintainer override — keeping real resource ids local

The committed `wrangler.toml` has **no** D1/KV ids so forkers get auto-provisioned
resources on first deploy. If you maintain the original `shopflare-db0` / KV /
`shopflare-images0` and want to keep deploying against them without committing real ids:

### Option A — git-ignored local override (recommended)

1. Copy `wrangler.toml` → `wrangler.local.toml` (already in `.gitignore`).
2. Add the real ids back to `wrangler.local.toml`.
3. Point wrangler at it for your own deploys:

```bash
WRANGLER_CONFIG=wrangler.local.toml pnpm worker:deploy
```

Or alias it permanently in your shell / `.envrc`.

### Option B — re-link via dashboard

Wrangler matches resources by `database_name` / `bucket_name` where possible.
After stripping ids, run `pnpm worker:deploy` once — if wrangler finds an existing
resource with the same name on your account it re-links rather than creating a
duplicate. Check the Cloudflare dashboard to confirm the correct resource is bound.

Either option preserves the existing data; no orphaned or duplicated resources.
