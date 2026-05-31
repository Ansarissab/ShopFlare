# Architecture Overview

## Request flow

```
Customer browser
  → Cloudflare CDN (Pages)
    → Static Next.js HTML/JS
      → Cloudflare Worker (Hono API)
        → Cloudflare D1 (SQLite DB)
        → Cloudflare KV (cache)
        → Cloudflare R2 (images)
        → Stripe API
        → Resend API
```

## Two runtimes

| Runtime | Role |
|---|---|
| **Next.js (CF Pages)** | Static HTML/JS served from CDN. All UI. |
| **CF Worker (Hono)** | API, webhooks, Stripe calls, DB access |

The Next.js app is a pure static export. No server-side rendering.
Dynamic data fetched client-side from CF Worker endpoints.

## Admin access

CF Access intercepts `/admin/*` at the edge.
Merchant gets email OTP — no passwords, no auth code.

## Data flow for an order

1. Customer selects product → adds to cart (localStorage)
2. Clicks "Buy Now" → client calls CF Worker `/api/stripe/checkout-session`
3. CF Worker creates Stripe session → returns URL
4. Client redirects to Stripe-hosted checkout
5. Customer pays
6. Stripe fires webhook → CF Worker `/api/stripe/webhook`
7. CF Worker verifies signature → creates order in D1 → sends Resend email → fires Web Push to merchant
8. Customer redirected to `/track/ORD-XXXXX`
