# SinglePageEcomm

> White-label serverless ecommerce for small businesses. **$0 hosting cost.**

[![Next.js](https://img.shields.io/badge/Next.js-16.2-black)](https://nextjs.org)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-Stack-orange)](https://cloudflare.com)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

## What is this?

A free, open-source, self-hosted ecommerce store. Fork it, configure it, start selling. No monthly fees.

Replaces Shopify Basic ($29/month) for merchants selling a few products — especially in emerging markets.

## Stack

| Layer | Technology |
| --- | --- |
| Hosting | Cloudflare Pages (free) |
| API / Webhooks | Cloudflare Workers + Hono |
| Database | Cloudflare D1 (SQLite) + Drizzle ORM |
| Cache | Cloudflare KV |
| Images | Cloudflare R2 (zero egress) |
| Admin Auth | Cloudflare Access |
| Payments | Stripe Checkout |
| Email | Resend (BCC strategy) |
| Push Notifications | PWA Web Push |
| Frontend | Next.js 16.2 + React 19 + Tailwind 4.3 + shadcn/ui |

## Quick Setup

```bash
# 1. Fork this repo
# 2. Install deps
pnpm install

# 3. Run setup wizard (guides you through CF + Stripe setup)
pnpm setup

# 4. Start local dev
pnpm dev
```

See [docs/setup/quickstart.md](docs/setup/quickstart.md) for full guide.

## Build Progress

### Phase 0 — Foundation

- [x] Project scaffold (Next.js 16.2, pnpm, TypeScript)
- [x] Cloudflare Workers + Hono setup
- [x] D1 database schema (Drizzle ORM)
- [x] shadcn/ui + Tailwind theme (light/dark)
- [x] lib/ skeleton (constants, i18n, schemas, utils)
- [x] Phase 0 complete

### Phase 1 — Store Frontend

- [x] Product catalog + variant selector
- [x] Cart (Zustand + localStorage)
- [x] Checkout flows (Stripe, COD, WhatsApp)
- [x] Order tracking page
- [x] Phase 1 complete

### Phase 2 — Admin Dashboard

- [ ] Product CRUD + image upload (R2)
- [ ] Order management
- [ ] Coupon management
- [ ] POS (cash register mode)

### Phase 3 — Polish

- [ ] Reviews + ratings
- [ ] PWA push notifications
- [ ] SEO + sitemap + JSON-LD
- [ ] Setup wizard CLI

## Cost Breakdown

Normal operations: **$0/month**
Black Friday (100k orders): **~$5-10**

See [docs/architecture/cost-breakdown-normal.md](docs/architecture/cost-breakdown-normal.md)

## License

MIT
