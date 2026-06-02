# ShopFlare

> White-label serverless ecommerce for small businesses. **$0 hosting cost.**

[![Next.js](https://img.shields.io/badge/Next.js-16.2-black)](https://nextjs.org)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-Stack-orange)](https://cloudflare.com)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

A free, open-source, self-hosted online store. Fork it, run the setup wizard, start selling.
No monthly platform fees — it runs entirely on Cloudflare's free tier and Stripe's
pay-per-transaction pricing. Built for small merchants selling a handful of products,
especially in emerging markets (COD + WhatsApp ordering are first-class).

Replaces Shopify Basic ($29/month) for stores that don't need the heavyweight platform.

---

## Table of contents

- [Features](#features)
- [Stack](#stack)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Seeding demo data](#seeding-demo-data)
- [Scripts](#scripts)
- [Security model](#security-model)
- [Testing & CI](#testing--ci)
- [Deployment](#deployment)
- [Documentation](#documentation)
- [Cost](#cost)
- [License](#license)

---

## Features

**Storefront**
- Product catalog with variants (colour) and size options (per-size price, SKU, stock)
- Cart with localStorage persistence (Zustand) and live shipping/free-shipping threshold
- Three checkout paths: **Stripe Checkout** (card), **Cash on Delivery**, and **WhatsApp** order hand-off
- Coupons (percentage / fixed, min-order, usage + per-customer limits)
- Order tracking page and self-service cancellation (while pending/confirmed)
- Verified-purchase **reviews + ratings** (only delivered orders, admin-moderated)
- **Notify-me** restock requests on out-of-stock sizes, with automatic restock emails
- PWA: installable, with Web Push order alerts
- SEO: sitemap + JSON-LD product structured data

**Admin dashboard** (protected by Cloudflare Access)
- Product / variant / size CRUD with R2 image upload (client-compressed)
- Order management: status, tracking number + carrier, full customer detail
- Coupon management with automatic Stripe coupon + promotion-code sync
- Review moderation (approve / delete)
- Restock-request inbox
- **POS** (in-person cash register mode)
- Store settings: name, tagline, logo, currency, shipping, contact — all editable, **no redeploy**

**Dynamic-first:** anything a non-developer needs to change lives in D1 and is editable from the
admin dashboard. Code redeploys are only for actual code changes.

---

## Stack

| Layer | Technology |
| --- | --- |
| Hosting (frontend) | Cloudflare Pages (free) |
| API / Webhooks | Cloudflare Workers + [Hono](https://hono.dev) |
| Database | Cloudflare D1 (SQLite) + [Drizzle ORM](https://orm.drizzle.team) |
| Cache / rate-limit | Cloudflare KV |
| Images | Cloudflare R2 (zero egress) |
| Admin auth | Cloudflare Access (edge) + in-Worker JWT re-verification |
| Bot protection | Cloudflare Turnstile |
| Payments | Stripe Checkout (no raw card data) |
| Email | Resend (single send, merchant BCC) |
| Push | Web Push API (VAPID) |
| Frontend | Next.js 16.2 · React 19 · Tailwind 4 · shadcn/ui |
| Validation | Zod v4 (shared client + Worker) |

---

## Architecture

```
Browser ──► Cloudflare Pages (Next.js static + RSC)
   │
   │  fetch (lib/api.ts)
   ▼
Cloudflare Worker (Hono)  ──►  D1 (orders, products, coupons, …)
   ├─ /api/*          public: products, config, orders (COD/track/cancel),
   │                  coupons/validate, reviews, notify
   ├─ /api/stripe/*   checkout-session + signed webhook
   └─ /api/admin/*    Cloudflare Access-gated CRUD (re-verified in Worker)
        │
        ├─► R2  (product images, served back via /cdn/*)
        ├─► KV  (Access JWKS cache, per-IP rate-limit buckets)
        ├─► Stripe   (coupons, promotion codes, checkout sessions)
        └─► Resend / Web Push  (order + restock notifications)
```

Key boundaries:
- **D1 is never reached from the browser** — only through the Worker.
- **Public vs admin** routes are split by URL prefix so Cloudflare Access can guard
  `/api/admin/*` at the edge without touching the public checkout surface.
- **Prices are server-authoritative** — the client sends only `{ sizeOptionId, quantity }`
  (or a Stripe price id); the Worker computes every amount from D1.

See [docs/architecture/overview.md](docs/architecture/overview.md) and [docs/adr/](docs/adr/).

---

## Project structure

```
src/
  app/(store)/        storefront routes (catalog, product, cart, checkout, track)
  app/(admin)/        admin dashboard routes (CF Access protected)
  components/         ui (shadcn) · store · admin · common
  hooks/              useCart, useStoreConfig, usePushSubscription, …
  lib/
    api.ts            ALL network I/O (apiGet/apiPost/…). Never raw fetch.
    constants/        ORDER_STATUSES, CURRENCIES, PAYMENT_METHODS, limits
    i18n/en.ts        ALL UI strings (never hardcode in components)
    schemas/          Zod v4 schemas, shared client + Worker
    types/store.ts    composite + component prop types
worker/
  index.ts            Hono entry + CORS + /cdn/* + public-config
  routes/             public routers + routes/admin/* (CF Access gated)
  lib/                orders, money, turnstile, ratelimit, access, email, push, notify
  db/                 Drizzle schema, migrations, seed.sql
docs/                  ADRs, architecture, features, setup guides
scripts/setup/        interactive setup wizard (pnpm setup)
```

Conventions are enforced — see [docs/architecture/dry-conventions.md](docs/architecture/dry-conventions.md).
Imports use path aliases only: `@/*` for `src`, `worker/*` for the Worker (no `../` traversal).

---

## Quick start

**Prerequisites:** Node 20+, `pnpm` 9, a Cloudflare account, and a Stripe account.

```bash
# 1. Fork + clone, then install
pnpm install

# 2. Run the interactive setup wizard — provisions/guides CF + Stripe config
pnpm setup

# 3. Seed the local D1 and run EVERYTHING (worker + web) with one command
pnpm dev:fresh       # = migrate + seed local D1, then run both services
```

`dev:fresh` runs the migrations, seeds the demo data, and starts both services together.
Equivalent split commands:

```bash
pnpm dev:setup       # migrate + seed local D1 (first run / reset)
pnpm dev:all         # run web (:3000) + worker (:8787) together
# or, individually, in two terminals:
pnpm worker:dev      # http://localhost:8787
pnpm dev             # http://localhost:3000
```

`pnpm dev:all` uses `concurrently`; a `Procfile.dev` is also provided for
foreman/overmind. The frontend defaults `NEXT_PUBLIC_WORKER_URL` to
`http://localhost:8787` in dev, so **no `.env.local` is needed locally**.

Open http://localhost:3000 — the seeded demo store (3 products, 2 coupons, a sample
review) loads immediately. The admin dashboard is at `/admin`.

> In local dev, when Cloudflare Access and Turnstile are unconfigured the Worker logs a
> loud warning and bypasses them so you can work without a tunnel. Both **fail closed in
> production** (a deployed Worker forces `ENVIRONMENT=production`).

---

## Configuration

Secrets live in `.dev.vars` (local Worker) and `.env.local` (Next.js) — both gitignored.
Copy the examples and fill them in (the setup wizard does this for you):

```bash
cp .dev.vars.example .dev.vars
cp .env.local.example .env.local
```

| Variable | Where | Purpose |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Worker | Stripe API calls + webhook verify |
| `STRIPE_WEBHOOK_SECRET` | Worker | Verifies `/api/stripe/webhook` signatures |
| `STRIPE_PUBLISHABLE_KEY` | Worker | Returned via `/api/public-config` |
| `TURNSTILE_SECRET_KEY` / `TURNSTILE_SITE_KEY` | Worker | Bot protection on public POSTs |
| `CF_ACCESS_TEAM_DOMAIN` / `CF_ACCESS_AUD` | Worker | Admin JWT re-verification |
| `RESEND_API_KEY` / `RESEND_FROM` | Worker | Transactional email |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Worker | Web Push |
| `FRONTEND_URL` | Worker | CORS allow-list + email/redirect links |
| `ENVIRONMENT` | Worker | `development` locally; forced `production` on deploy |
| `NEXT_PUBLIC_WORKER_URL` | Next.js | Worker origin the client calls |

Cloudflare bindings (`wrangler.toml`): `DB` (D1), `KV`, `R2`. The `database_id` / KV `id`
placeholders are filled after you create the resources (the wizard handles this).

Full reference: [docs/setup/environment-variables.md](docs/setup/environment-variables.md).

---

## Seeding demo data

`worker/db/seed.sql` is a single, idempotent, executable seed that populates **everything**
needed to see the store working end-to-end:

- store config (name, currency, shipping)
- 3 products with variants, size options (incl. one out-of-stock and one unlimited), images
- 2 coupons (`WELCOME10`, `FLAT500`)
- 1 sample delivered order + 1 approved review (so the admin dashboard and product reviews
  aren't empty)

```bash
pnpm db:seed:local     # local D1
pnpm db:seed           # remote D1
```

Every row uses a fixed `demo_*` id with `INSERT OR IGNORE`, so re-running never clobbers data
you've edited in admin. Delete the `demo_*` rows to remove the sample data.

---

## Scripts

| Script | Description |
| --- | --- |
| `pnpm dev` | Next.js dev server |
| `pnpm worker:dev` | Wrangler dev server for the Worker API |
| `pnpm build` | Production build of the Next.js app |
| `pnpm setup` | Interactive CF + Stripe setup wizard |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc` for the app **and** the Worker |
| `pnpm test` / `pnpm test:watch` | Vitest unit tests |
| `pnpm db:generate` | Generate a Drizzle migration from `db/schema.ts` |
| `pnpm db:migrate[:local]` | Apply D1 migrations (remote / local) |
| `pnpm db:seed[:local]` | Run `seed.sql` (remote / local) |
| `pnpm worker:deploy` | Deploy the Worker (`ENVIRONMENT=production`) |

---

## Security model

- **No raw card data** — Stripe Checkout only; webhooks are signature-verified and idempotent
  (deduped via a `stripe_events` table).
- **D1 only via the Worker** — never exposed to the browser.
- **Admin** — Cloudflare Access at the edge **plus** RS256 JWT re-verification inside the Worker
  (JWKS cached in KV), so the admin API stays protected even if the Worker origin is hit directly.
- **Public POSTs** (COD, Stripe checkout-session, reviews, notify, coupon-validate) are gated by
  **Cloudflare Turnstile** and a coarse **per-IP KV rate limit**.
- **Server-authoritative pricing** — the client cannot set prices or discounts.
- **Order numbers** are high-entropy (`ORD-` + 8 unambiguous chars, ~8.5×10¹¹ space) and the
  track/cancel endpoints are rate-limited.
- **Secrets** live only in Worker env vars / `.env.local` (gitignored); user-supplied content is
  HTML-escaped in emails and JSON-LD.

Run a security review with the project's tooling before each release.

---

## Testing & CI

Two Vitest projects (a workspace), both run by `pnpm test`:

- **unit** (node) — pure logic: money formatter, coupon evaluation, order-schema validation.
- **integration** (workers pool via `@cloudflare/vitest-pool-workers`) — the **real Worker**
  running in `workerd` against an ephemeral D1/KV/R2 with the migrations applied. Drives the
  money paths end-to-end through `fetch`: product listing, COD + bank-transfer checkout, stock
  decrement, **concurrent oversell protection**, coupon validation, cancel + stock restore,
  the review verified-purchase gate, Stripe webhook signature rejection, and admin CRUD.

```bash
pnpm test            # all projects (31 tests)
pnpm test:coverage   # unit coverage report
pnpm typecheck && pnpm test && pnpm build
```

**GitHub Actions** ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs lint, typecheck
(app + Worker), tests, and a production build on every push / PR to `main`.

---

## Deployment

1. Create the Cloudflare resources (D1, KV, R2, Access app, Turnstile widget) — the wizard
   prints the exact commands; see [docs/setup/cloudflare-guide.md](docs/setup/cloudflare-guide.md).
2. Set Worker secrets: `wrangler secret put STRIPE_SECRET_KEY` (etc.).
3. Apply migrations + seed: `pnpm db:migrate && pnpm db:seed`.
4. Deploy the Worker: `pnpm worker:deploy`.
5. Deploy the Next.js app to Cloudflare Pages (connect the repo or `wrangler pages deploy`).
6. Point `FRONTEND_URL` (Worker) and `NEXT_PUBLIC_WORKER_URL` (Pages) at the deployed origins.
7. Register the Stripe webhook → `<worker-origin>/api/stripe/webhook`.

Domain setup: [docs/setup/domain-setup.md](docs/setup/domain-setup.md).

---

## Documentation

- Setup: [quickstart](docs/setup/quickstart.md) · [Cloudflare](docs/setup/cloudflare-guide.md) · [Stripe](docs/setup/stripe-setup.md) · [Resend](docs/setup/resend-setup.md) · [env vars](docs/setup/environment-variables.md)
- Architecture: [overview](docs/architecture/overview.md) · [DB schema](docs/architecture/database-schema.md) · [payment flows](docs/architecture/payment-flows.md) · [caching](docs/architecture/caching-strategy.md)
- Decisions: [docs/adr/](docs/adr/)
- Features: [Stripe](docs/features/stripe-checkout.md) · [COD](docs/features/cod-orders.md) · [coupons](docs/features/coupons.md) · [inventory](docs/features/inventory.md) · [reviews/notify](docs/features/pwa-notifications.md) · [WhatsApp](docs/features/whatsapp.md)
- Admin guide: [docs/admin-guide/](docs/admin-guide/)

---

## Cost

Normal operations: **$0/month** (Cloudflare free tier + Stripe per-transaction fees only).
Black Friday spike (~100k orders): **~$5–10**. See
[docs/architecture/cost-breakdown-normal.md](docs/architecture/cost-breakdown-normal.md).

---

## License

MIT
