# ShopFlare

White-label serverless ecommerce for small businesses. **$0 hosting cost.** Runs entirely on Cloudflare's free tier — no servers to manage, no monthly platform fees.

[![Next.js](https://img.shields.io/badge/Next.js-16.2-black)](https://nextjs.org)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-Stack-orange)](https://cloudflare.com)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Ansarissab/ShopFlare)

> **Deploy button deploys the API worker only.** For a full store (both workers +
> migrations + Stripe webhook auto-setup), fork the repo and run `pnpm setup`.

🧪 **2084** unit tests &nbsp;·&nbsp; 🔗 integration suite (real Worker in workerd) &nbsp;·&nbsp; 📊 **95%** coverage

A free, open-source, self-hosted online store. Fork it, run the setup wizard, start selling.
No monthly platform fees — it runs entirely on Cloudflare's free tier and Stripe's
pay-per-transaction pricing. Built for small merchants selling a handful of products,
especially in emerging markets (COD + WhatsApp ordering are first-class).

Replaces Shopify Basic ($29/month) for stores that don't need the heavyweight platform.

---

## Demo

<!-- Replace REPLACE_WITH_HOSTED_VIDEO_URL with your hosted link (YouTube, CDN, or GitHub Release).
     Do NOT commit the video file to the repo. -->
[![Watch the ShopFlare demo](https://img.shields.io/badge/▶_Watch-Store_%26_Admin_demo-FF4F64)](REPLACE_WITH_HOSTED_VIDEO_URL)

A 60-second tour of the storefront and admin dashboard, running on the seeded demo data.

---

## Table of contents

- [Demo](#demo)
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
- **Client-side fuzzy search** (Fuse.js, threshold 0.35) across product name, description, and variant labels — no extra API call
- **Infinite-scroll pagination** via native IntersectionObserver; page size admin-configurable (6–96, default 24)
- **Real-time data freshness**: products refetch silently every 60 s + on tab focus + on cross-tab admin writes
- URL-shareable filters: `?q=keyword&category=slug` — bookmarkable, back-button safe
- Cart with localStorage persistence (Zustand) and live shipping/free-shipping threshold
- Three checkout paths: **Stripe Checkout** (card), **Cash on Delivery**, and **WhatsApp** order hand-off (optional, admin-toggleable; includes a floating chat widget on every storefront page)
- Coupons (percentage / fixed, min-order, usage + per-customer limits)
- Order tracking page and self-service cancellation (while pending/confirmed)
- Verified-purchase **reviews + ratings** (only delivered orders, admin-moderated; toggleable site-wide and per-product — no redeploy needed)
- **Notify-me** restock requests on out-of-stock sizes, with automatic restock emails
- **Storytelling landing page** (toggleable): hero, brand story, featured products strip, reviews strip, and CTA band — all editable from admin without redeploy. When enabled, the product catalog moves to `/shop`.
- **Selectable landing templates** — multiple named landing pages, each rendered by one of several designs (Classic, plus Wise/Stripe/YC-inspired layouts built from the store's own theme tokens); pick which is live from admin, no redeploy.
- **Smart sticky header** — hides on scroll-down, returns on scroll-up; reduced-motion aware.
- PWA: installable, with Web Push order alerts
- **SEO / GEO / AEO**: server-rendered metadata + JSON-LD on every page (Product, Category, Organization, BreadcrumbList, FAQPage, Article); sitemap with `lastModified`; toggleable LLM discovery (`/llms.txt`, Markdown `.md` twins, AI-bot policy in `robots.txt`)
- **Blog**: toggleable merchant blog at `/blog` — Trix rich text editor, cover images (R2), tags, draft/published workflow, RSS feed at `/blog/rss.xml`, Article structured data, included in sitemap
- **Status / uptime**: machine `GET /healthz` (D1/KV/R2 probed independently, 200 ok / 503 degraded), public `/status` SSR live snapshot, and Better Stack free-tier monitor for uptime history + alerts
- **Global search overlay** — header search button (and `/` shortcut) opens a lazy-loaded product-search modal from any page; full catalog searched via Fuse.js with category + in-stock filters; results link directly to products
- **Announcement bar** — thin dismissible banner above the header; merchant-controlled from admin (types: single, scheduled with start/end datetime, or rotating carousel); dismissal keyed to message version so a new announcement re-shows; CSS-driven carousel, `prefers-reduced-motion`-aware
- **Dedicated FAQ page** (`/faq`) — store-wide accordion (multi-open, RTL-aware), feature-flag-gated; per-product FAQ accordion on each product page; FAQPage JSON-LD emitted on both; admin add/remove/reorder rows without redeploy
- **i18n locale engine** — middleware path-prefix routing (`/fr`, `/ur`); `getT()` / `useT()` resolver; locale switcher in header + admin; RTL layout for Urdu with scoped Noto Nastaliq font; en/fr/ur dictionaries (fr/ur UI chrome scaffolded, real translations are a follow-up); `enabledLocales` + `defaultLocale` configurable in admin without redeploy
- **Keyboard shortcuts** — `/` search, `c` cart, `?` cheat-sheet, `Esc` close; localized + RTL-aware, respects reduced-motion

**Admin dashboard** (app-level password login → Bearer session token)
- Product / variant / size CRUD with R2 image upload (client-compressed; large images auto-optimized with a before/after confirm step)
- Order management: status, tracking number + carrier, full customer detail
- Coupon management with automatic Stripe coupon + promotion-code sync
- Review moderation (approve / delete)
- Restock-request inbox
- **POS** (in-person cash register mode)
- Store settings: name, tagline, logo, currency, shipping, contact, **products per page** — all editable, **no redeploy**
- **Style Presets**: 6 named looks (Midnight, Emerald, Sunset, Ocean, Elegant, Playful), each setting colors, font, radius, density, and hero layout in one click via the CSS-variable theme engine
- **Tax settings** — optional flat-rate tax (GST/VAT/Sales Tax); exclusive (add on top) or inclusive (extracted for display); configurable tax name, rate, basis (subtotal only or subtotal + shipping), and registration number; tax line shown in cart, checkout, order tracking, and admin order detail; persisted as immutable `taxCents` snapshot on every order
- **Advanced analytics** — tabbed dashboard (Overview · Products · Customers · Funnel); product leaderboard, variant/size breakdown, slow-movers, frequently-bought-together pairs; customer RFM segmentation, repeat-rate, CLV; checkout-abandonment rate from existing pending orders; per-product stats panel on each product edit page
- **Marketing & SEO** — admin-configurable GA4, Google Ads, and Meta Pixel IDs loaded only after cookie consent; cookie consent banner (GDPR-aware, gates all tags); Google Search Console + Bing site-verification meta tags; IndexNow auto-ping on product changes; hreflang alternates + per-locale sitemap URLs for enabled locales
- **Keyboard shortcuts** — `g`-prefixed "go to" navigation (orders/products/coupons/analytics), `c` create, `j`/`k` row navigation, `/` search, `?` cheat-sheet

**Dynamic-first:** anything a non-developer needs to change lives in D1 and is editable from the
admin dashboard. Code redeploys are only for actual code changes.

---

## Stack

| Layer | Technology |
| --- | --- |
| Hosting (frontend) | Cloudflare **Workers** — Next.js SSR via [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare) (`shopflare-web`) |
| API / Webhooks | Cloudflare Workers + [Hono](https://hono.dev) (`shopflare-worker`) |
| Database | Cloudflare D1 (SQLite) + [Drizzle ORM](https://orm.drizzle.team) |
| Cache / rate-limit | Cloudflare KV |
| Images | Cloudflare R2 (zero egress; card on file required, $0 under free tier) |
| Admin auth | App-level password → HMAC session token (Bearer), verified in the API Worker |
| Bot protection | Cloudflare Turnstile |
| Payments | Stripe Checkout (no raw card data) |
| Email | Resend (single send, merchant BCC) |
| Push | Web Push API (VAPID) — merchant new-order + customer order-status |
| PWA | Serwist (offline + precache), Background Sync, TWA packaging for Google Play |
| Frontend | Next.js 16.2 · React 19 · Tailwind 4 · shadcn/ui |
| Validation | Zod v4 (shared client + Worker) |

---

## Architecture

```
Browser ──► Frontend Worker  (Next.js SSR via OpenNext — shopflare-web)
   │
   │  fetch (lib/api.ts) + Authorization: Bearer <admin token> on /api/admin/*
   ▼
API Worker (Hono — shopflare-worker)  ──►  D1 (orders, products, coupons, …)
   ├─ /api/*            public: products, config, orders (COD/track/cancel),
   │                    coupons/validate, reviews, notify
   ├─ /api/stripe/*     checkout-session + signed webhook
   ├─ /api/admin/login  password → HMAC session token (Turnstile + rate-limited)
   └─ /api/admin/*      token-gated CRUD (requireAdmin verifies the Bearer token)
        │
        ├─► R2  (product images, served back via /cdn/*)
        ├─► KV  (per-IP rate-limit buckets)
        ├─► Stripe   (coupons, promotion codes, checkout sessions)
        └─► Resend / Web Push  (order + restock notifications)
```

Key boundaries:
- **D1 is never reached from the browser** — only through the API Worker.
- **Public vs admin** routes are split by URL prefix; `/api/admin/*` requires a valid
  Bearer session token (the admin UI is a static shell that fetches via the API, so
  it carries no protected data itself).
- **Two separate `*.workers.dev` hosts** (frontend + API) → cookies can't be shared
  (public-suffix domain), so the admin token travels as an `Authorization` header.
- **Prices are server-authoritative** — the client sends only `{ sizeOptionId, quantity }`
  (or a Stripe price id); the Worker computes every amount from D1.

See [docs/architecture/overview.md](docs/architecture/overview.md) and [docs/adr/](docs/adr/).

---

## Project structure

```
src/
  app/(store)/        storefront routes (catalog, product, cart, checkout, track)
  app/(admin)/        admin dashboard routes (token-gated: /admin/login + AdminShell)
  components/         ui (shadcn) · store · admin · common
  hooks/              useCart, useStoreConfig, usePushSubscription, …
  lib/
    api.ts            ALL client network I/O (apiGet/apiPost/…). Never raw fetch.
    server/           server-only helpers: fetchFromWorker (typed ISR fetch for RSC)
    features.ts       isFeatureEnabled — feature-flag helper (worker mirror in worker/lib/)
    html.ts           sanitizeHtml (DOMPurify) — sanitize merchant HTML before render
    image.ts          compressImage — single compression config for all upload paths
    seo/              jsonld builders + buildPageMetadata (used in generateMetadata)
    constants/        ORDER_STATUSES, CURRENCIES, PAYMENT_METHODS, FEATURE_FLAGS, limits, shortcuts
    keyboard/         dispatcher.ts — pure sequence matcher + input-field guard
    i18n/en.ts        ALL UI strings (never hardcode in components)
    schemas/          Zod v4 schemas, shared client + Worker
    types/store.ts    composite + component prop types
  components/shared/  RichText (Trix editor), RenderHtml, ImageUpload, JsonLd
worker/
  index.ts            Hono entry + CORS + /cdn/* + public-config
  routes/             public routers + routes/admin/* (token-gated; admin/login is public)
  lib/                orders, money, turnstile, ratelimit, access (requireAdmin),
                      admin-session (HMAC tokens), email, push, notify
  db/                 Drizzle schema, migrations, seed.sql
docs/                  ADRs, architecture, features, setup guides
scripts/setup/        interactive setup wizard (pnpm setup)
```

Conventions are enforced — see [docs/architecture/dry-conventions.md](docs/architecture/dry-conventions.md).
Imports use path aliases only: `@/*` for `src`, `worker/*` for the Worker (no `../` traversal).

---

## Quick start

**Prerequisites:** Node 22+, `pnpm` 9, a Cloudflare account, and a Stripe account.

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

> In local dev, set `ENVIRONMENT=development` and `ADMIN_DEV_BYPASS=1` in `.dev.vars`
> to bypass the admin token check and reach `/admin` without logging in. Both flags are
> required together — neither alone is sufficient. Turnstile is also bypassed in dev.
> Both **fail closed in production**.

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
| `STRIPE_SECRET_KEY` | API Worker | Stripe API calls + webhook verify |
| `STRIPE_WEBHOOK_SECRET` | API Worker | Verifies `/api/stripe/webhook` signatures |
| `STRIPE_PUBLISHABLE_KEY` | API Worker | Returned via `/api/public-config` |
| `TURNSTILE_SECRET_KEY` / `TURNSTILE_SITE_KEY` | API Worker | Bot protection on public POSTs + admin login |
| `ADMIN_PASSWORD` | API Worker | The admin login password (rotate any time, no redeploy) |
| `ADMIN_SESSION_SECRET` | API Worker | HMAC key for admin session tokens (`openssl rand -hex 32`) |
| `RESEND_API_KEY` / `RESEND_FROM` | API Worker | Transactional email |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | API Worker | Web Push |
| `FRONTEND_URL` | API Worker | CORS allow-list + email/redirect links (frontend worker origin) |
| `ENVIRONMENT` | API Worker | `development` locally; forced `production` on deploy |
| `NEXT_PUBLIC_WORKER_URL` | Next.js (build-time) | API Worker origin the client calls |

Cloudflare bindings (`wrangler.toml`): `DB` (D1 `shopflare-db0`), `KV`, `R2` (`shopflare-images0`).
The `database_id` / KV `id` are filled after you create the resources. The frontend worker uses
a separate `wrangler.frontend.jsonc` (built by OpenNext) and needs **no** runtime secrets.

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

> ⚠️ **Demo data — not for a real store.** This includes two **active, no-expiry** coupons
> (`WELCOME10`, `FLAT500`) plus fake products/orders. If you're launching a store you actually
> sell from, **don't seed it** — or clear the demo rows afterward (`DELETE FROM <table> WHERE
> id LIKE 'demo_%'`; the active coupons especially must not survive into a live store). See the
> header of `worker/db/seed.sql` for the full one-pass cleanup.

---

## Scripts

| Script | Description |
| --- | --- |
| `pnpm dev` | Next.js dev server |
| `pnpm worker:dev` | Wrangler dev server for the API Worker |
| `pnpm build` | Turbopack production build of the Next.js app (fast; does **not** inject the Serwist SW) |
| `pnpm build:webpack` | Webpack production build — injects the Serwist service worker (required before `web:deploy`) |
| `pnpm web:preview` | Build via OpenNext + preview the frontend worker locally (workerd) |
| `pnpm web:deploy` | Build via OpenNext + deploy the frontend worker (`shopflare-web`) |
| `pnpm setup` | Interactive CF + Stripe setup wizard |
| `pnpm lint` | oxlint |
| `pnpm typecheck` | `tsgo` (native, fast) for app + Worker + SW; `pnpm typecheck:tsc` for the stock `tsc` |
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
- **Admin** — app-level password login (`/api/admin/login`) issues an HMAC-signed session
  token (constant-time password check, Turnstile, per-IP rate limit); every `/api/admin/*`
  request is gated by `requireAdmin` verifying that Bearer token. Fails closed. No account
  creation — one password, rotated via `wrangler secret put ADMIN_PASSWORD`.
- **Public POSTs** (COD, Stripe checkout-session, reviews, notify, coupon-validate) are gated by
  **Cloudflare Turnstile** and a coarse **per-IP KV rate limit**.
- **Server-authoritative pricing** — the client cannot set prices or discounts.
- **Order numbers** are high-entropy (`ORD-` + 8 unambiguous chars, ~8.5×10¹¹ space) and the
  track/cancel endpoints are rate-limited.
- **Secrets** live only in Worker env vars / `.env.local` (gitignored); user-supplied content is
  HTML-escaped in emails and JSON-LD.

Run a security review with the project's tooling before each release.

---

## PWA

Both the storefront and admin dashboard are installable Progressive Web Apps.

### Storefront (customer)

- "Add to Home Screen" on iOS / install prompt on Android/desktop.
- Offline catalog browsing — products and store config precached by Serwist.
- Background Sync — COD checkout queued in IndexedDB when offline, replayed on reconnect.
- **Order status push**: after placing an order (or from the tracking page) customers can opt in to push notifications. They receive a push when their order is marked Shipped or Delivered.
- **Back-in-stock push**: customers who tap "Notify Me" on an out-of-stock size can also opt into push alerts (alongside email).
- iOS 16.4+ required for push (Home Screen web app only).

### Admin (merchant)

- Push notification on every new order — works even with phone screen off.
- Add the admin PWA to your home screen once; no app store needed.

### Google Play distribution

- A TWA (Trusted Web Activity) wrapper is provided in `packaging/twa/`.
- Lets you publish the storefront to Google Play with zero native code.
- See [docs/features/pwa-app-store.md](docs/features/pwa-app-store.md).

---

## Testing & CI

Two Vitest projects (a workspace), both run by `pnpm test`:

- **unit** (node) — pure logic: money formatter, coupon evaluation, order-schema validation.
- **integration** (workers pool via `@cloudflare/vitest-pool-workers`) — the **real Worker**
  running in `workerd` against an ephemeral D1/KV/R2 with the migrations applied. Drives the
  money paths end-to-end through `fetch`: product listing, COD + bank-transfer checkout, stock
  decrement, **concurrent oversell protection**, coupon validation, cancel + stock restore,
  the review verified-purchase gate, Stripe webhook signature rejection, and admin CRUD.

### `pnpm verify` — full quality gate

`pnpm verify` (alias `pnpm run ci`) runs the whole bar fail-fast. Steps:

| Step | What runs | Skipped by |
| --- | --- | --- |
| 1 | **typecheck** — alone, fail-fast | — |
| 2 | **lint + build + unit+coverage** — concurrent (build is the long-pole; overlapping saves ~70 s) | build: `--quick` / `--no-build` |
| 3 | **integration** — miniflare/workerd, sequential | `--quick` |
| 4 | **smoke** — Playwright `@smoke` critical-path specs, sequential | `--quick` |
| 5 | **e2e** — full Playwright suite excluding `@smoke` and `visual:` specs, sequential | `--quick` |
| 6 | **visual** — native screenshot regression, opt-in | must pass `--visual` |

```bash
pnpm verify              # full gate (no visual)
pnpm verify --quick      # typecheck + lint + unit only (fast dev loop)
pnpm verify --no-build   # skip the production build
pnpm verify --visual     # full gate + native visual regression
```

**Standalone scripts:**

```bash
pnpm test:coverage        # unit coverage only (gate: 95%)
pnpm test:integration     # integration suite only (miniflare/workerd)
pnpm test:smoke           # @smoke specs only
pnpm test:e2e             # full e2e suite (boots its own dev server)
pnpm test:visual          # visual regression against local baselines
pnpm test:visual:update   # regenerate machine-local baselines
```

**E2E and smoke** each boot their own Next.js app + wrangler worker on dynamically-scanned
free ports, so they never collide with a running dev server and can be run while `pnpm dev`
is active.

**Coverage gate = unit project only, 95%.** Worker routes run in the miniflare/workerd pool
where v8 can't instrument them; they're covered behaviorally by the integration suite instead.
See [docs/adr/0008-coverage-gate-unit-only.md](docs/adr/0008-coverage-gate-unit-only.md).

**Visual baselines** are machine-specific and gitignored (`.visual-baselines/`). Run
`pnpm test:visual:update` once on `main` to generate them, then `pnpm test:visual` to diff
on a feature branch. No Docker required — visual runs natively.

**GitHub Actions** ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs lint, typecheck
(app + Worker), tests, and a production build on every push / PR to `main`.

---

## Deployment

Full walkthrough: [docs/setup/cloudflare-guide.md](docs/setup/cloudflare-guide.md).

**Recommended:** run `pnpm setup` — the wizard handles all steps below automatically.

1. Create R2 bucket (`npx wrangler r2 bucket create shopflare-images0`) — needs a card
   on file, stays $0. D1 and KV are **auto-provisioned** on first `pnpm worker:deploy`.
2. Apply migrations + seed: `pnpm db:migrate && pnpm db:seed`.
3. Set API worker secrets incl. `ADMIN_PASSWORD` + `ADMIN_SESSION_SECRET`.
4. Deploy the API worker: `pnpm worker:deploy` (auto-provisions D1 + KV on first run).
5. Set `NEXT_PUBLIC_*` in `.env.local`, then deploy the frontend worker: `pnpm web:deploy`
   (Next.js SSR via OpenNext — **not** Pages, **not** static export).
6. Set `FRONTEND_URL` (API worker) = the frontend worker origin, then `pnpm worker:deploy` again.
7. Stripe webhook is auto-created by `pnpm setup`; manual: Stripe Dashboard →
   `<api-worker>/api/stripe/webhook`, events `checkout.session.completed`,
   `checkout.session.expired`, `payment_intent.payment_failed`.
8. Set a Cloudflare **budget alert** ($1) and stay on the Workers free plan → $0.

Domain setup: [docs/setup/domain-setup.md](docs/setup/domain-setup.md).

---

## Documentation

- Setup: [quickstart](docs/setup/quickstart.md) · [Cloudflare](docs/setup/cloudflare-guide.md) · [Stripe](docs/setup/stripe-setup.md) · [Resend](docs/setup/resend-setup.md) · [env vars](docs/setup/environment-variables.md)
- Architecture: [overview](docs/architecture/overview.md) · [DB schema](docs/architecture/database-schema.md) · [payment flows](docs/architecture/payment-flows.md) · [caching](docs/architecture/caching-strategy.md)
- Decisions: [docs/adr/](docs/adr/)
- Features: [Stripe](docs/features/stripe-checkout.md) · [COD](docs/features/cod-orders.md) · [coupons](docs/features/coupons.md) · [inventory](docs/features/inventory.md) · [reviews/notify](docs/features/pwa-notifications.md) · [WhatsApp](docs/features/whatsapp.md)
- Admin guide: [docs/admin-guide/](docs/admin-guide/)
- Design system: [DESIGN.md](DESIGN.md) (Instrument Serif + Geist, warm-paper neutrals, oxidized-copper accent)
- Runbooks: [payments verification](docs/runbooks/payments-verification.md) (Stripe test-mode + bank transfer)

---

## Cost

Normal operations: **$0/month** (Cloudflare free tier + Stripe per-transaction fees only).
Black Friday spike (~100k orders): **~$5–10**. See
[docs/architecture/cost-breakdown-normal.md](docs/architecture/cost-breakdown-normal.md).

---

## License

MIT
