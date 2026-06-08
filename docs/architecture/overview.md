# Architecture Overview

## Request flow

```
Customer browser
  → Frontend Worker (Next.js SSR via OpenNext) + static assets from CDN
      → Cloudflare Worker (Hono API)
        → Cloudflare D1 (SQLite DB)
        → Cloudflare KV (cache)
        → Cloudflare R2 (images)
        → Stripe API
        → Resend API
```

## Two runtimes (two Workers)

| Runtime | Role |
|---|---|
| **Frontend Worker** (Next.js SSR via OpenNext, `shopflare-web`) | All UI: SSR/RSC + static assets |
| **API Worker** (Hono, `shopflare-worker`) | API, webhooks, Stripe calls, DB access |

The Next.js app is server-rendered (SSR/RSC), deployed as its own Worker via
`@opennextjs/cloudflare` — not a static export, not Cloudflare Pages. Data is
fetched from the API Worker (client-side, and server-side during SSR).

Public store pages (`/product/[slug]`, `/category/[slug]`, `/policy/[slug]`) are
async Server Components that fetch their entity via `fetchFromWorker()`, call
`generateMetadata()` server-side, and emit JSON-LD structured data in the initial
HTML. Client islands (`ProductHeroWrapper`, `CategoryProductSection`) receive
server-fetched data as props — no duplicate fetch on hydration.

## Admin access

App-level password — no Cloudflare Access (it can't path-scope `/admin` on
`*.workers.dev`). The merchant signs in at `/admin/login` with `ADMIN_PASSWORD`;
the API Worker issues an HMAC session token (`/api/admin/login`). All admin
endpoints live under `/api/admin/*` and are gated by `requireAdmin`, which
verifies the `Authorization: Bearer` token on every request (fails closed). The
admin UI is a client-gated static shell. See cloudflare-guide + ADR 0010.

## Data flow for an order

1. Customer selects product → adds to cart (localStorage)
2. Clicks "Buy Now" → client calls CF Worker `/api/stripe/checkout-session`
3. CF Worker creates Stripe session → returns URL
4. Client redirects to Stripe-hosted checkout
5. Customer pays
6. Stripe fires webhook → CF Worker `/api/stripe/webhook`
7. CF Worker verifies signature → creates order in D1 → sends Resend email → fires Web Push to merchant
8. Customer redirected to `/track/ORD-XXXXX`
