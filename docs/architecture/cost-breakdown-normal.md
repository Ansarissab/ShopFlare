# Cost Breakdown — Normal Operations

## Monthly estimate for typical small store

Assumptions: 500 orders/month, 1,000 daily visitors, 5 products

| Service | Free Tier | Usage | Cost |
|---|---|---|---|
| Cloudflare Pages | Unlimited BW | Static hosting | $0 |
| CF Workers | 100K req/day | ~2K req/day | $0 |
| CF D1 | 25M reads/day, 50K writes/day | ~1.5K writes/day | $0 |
| CF KV | 100K reads/day | ~5K reads/day | $0 |
| CF R2 | 10GB storage, 0 egress | ~500MB images | $0 |
| CF Access | Free ≤50 users | 1-2 admin users | $0 |
| CF Turnstile | Unlimited | All forms | $0 |
| CF Web Analytics | Free | All traffic | $0 |
| Resend | 3K emails/month | 500 order emails | $0 |
| Stripe | 2.9% + 30¢ | Per transaction | Variable |

**Total fixed cost: $0/month**
Stripe fees are % of revenue — not a platform cost.

## Comparison vs Shopify Basic

| | Shopify Basic | This project |
|---|---|---|
| Monthly platform fee | $29 | $0 |
| Transaction fee | 2% | $0 |
| COD feature | Paid app | Built-in |
| WhatsApp integration | Paid app | Built-in |
| Annual savings (500 orders @ $50 avg) | — | **$598+/year** |
