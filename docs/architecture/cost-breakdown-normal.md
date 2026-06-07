# Cost Breakdown — Normal Operations

> **Architecture note:** the storefront is **not** on Cloudflare Pages. It runs as a
> Next.js SSR Worker via OpenNext (`shopflare-web`) alongside the Hono API Worker
> (`shopflare-worker`). Admin auth is an app-level password, not CF Access — so
> Cloudflare Access / Zero Trust is **not used** and needs no card.

## Monthly estimate for a typical small store

Assumptions: 500 orders/month, 1,000 daily visitors, 5 products.

| Service | Free tier | Typical usage | Cost |
|---|---|---|---|
| CF Workers (frontend SSR + API) | 100K requests/day (account-wide) | ~few K req/day | $0 |
| CF Workers Static Assets (site JS/CSS/img) | Unlimited, unmetered | full bundle | $0 |
| CF D1 | 5 GB, 5M row-reads/day, 100K row-writes/day | ~1.5K writes/day | $0 |
| CF KV | 100K reads/day, 1K writes/day, 1 GB | ~5K reads/day | $0 |
| CF R2 | 10 GB storage, 1M Class-A + 10M Class-B ops/mo, **egress free** | ~hundreds of MB images | $0 |
| CF Turnstile | Unlimited | All public forms | $0 |
| CF Web Analytics | Free | All traffic | $0 |
| Resend | 3K emails/month | ~500 order emails | $0 |
| Stripe | 2.9% + 30¢ | Per transaction | Variable |

**Total fixed platform cost: $0/month.** Stripe fees are a % of revenue, not a platform cost.

## How to KEEP it $0 (guardrails)

1. **Stay on the Workers FREE plan.** On free, exceeding 100K req/day returns HTTP
   `429` — you are **never billed**. Do not upgrade to Workers Paid unless you
   intend to pay.
2. **R2 needs a card on file** (Cloudflare requires a payment method to enable R2),
   but stays $0 under the free limits above. Adding the card does not start billing.
3. **Don't enable paid products**: Workers Paid, Durable Objects, Images, etc.
4. **Set budget alerts** (below) so any projected spend > $0 emails you early.
5. **Zero Trust / CF Access: not used** — ignore any prompt to add a card for it.

## Budget & usage alerts (do this once)

Cloudflare Dashboard → **Manage Account → Billing → Billable Usage** → **Set Budget
Alert** → enter a small threshold (e.g. **$1**) → **Create**. (Or **Notifications →
Add → Budget Alert**.) Budget alerts are account-wide across all products and email
you when projected monthly spend first crosses the threshold. Add a couple (e.g. $1
and $5) for early warning. Also watch the per-product usage widgets (Workers, D1, R2).

## Storage hygiene (stay under R2's 10 GB)

- **R2 (`shopflare-images0`) is the only thing that accrues toward the 10 GB limit.**
  It holds product images uploaded via Admin. Deleting a product removes its images
  (handled in the worker), so orphans don't normally accumulate.
- **Workers Static Assets** (the site bundle, ~170 files) are **free and unmetered** —
  do **not** delete them; they serve the site.
- OpenNext is configured without an ISR cache binding, so it does **not** write to
  R2/KV/D1 for caching — no hidden storage growth there.
- Uploads are client-compressed (`browser-image-compression`) before hitting R2.
- To audit: R2 → `shopflare-images0` → metrics/objects in the dashboard. At launch
  you're effectively at 0 GB; no cleanup is needed to stay $0.

## Comparison vs Shopify Basic

| | Shopify Basic | This project |
|---|---|---|
| Monthly platform fee | $29 | $0 |
| Transaction fee | 2% | $0 |
| COD feature | Paid app | Built-in |
| WhatsApp integration | Paid app | Built-in |
| Annual savings (500 orders @ $50 avg) | — | **$598+/year** |
