# Cost Breakdown — Black Friday Scale

## Estimate for 100K orders in one day

| Service | Free Tier | At 100K orders | Overage Cost |
|---|---|---|---|
| CF Pages | Unlimited BW | Unlimited served | $0 |
| CF Workers | 100K req/day | ~300K req | +$5/mo plan |
| CF D1 writes | 50K/day free | 300K writes | ~$0.18 |
| CF D1 reads | 25M/day free | ~500K reads (KV cached) | $0 |
| CF KV reads | 100K/day free | Millions (cache hits) | +$5/mo plan |
| CF R2 | Zero egress | Millions of image serves | $0 |
| Resend | 3K/month free | 100K emails | ~$20 |
| Stripe | 2.9% + 30¢ | Per transaction | Variable |

**Total fixed cost for Black Friday: ~$25-30**

## Why so cheap?

1. **KV cache absorbs reads** — product catalog served from edge cache, not D1
2. **R2 zero egress** — no per-GB transfer cost unlike S3/Firebase
3. **CF Pages bandwidth** — truly unlimited on all plans
4. **Blaze-equivalent pricing** — D1 overage is $0.06 per 100K writes

## Scaling playbook

For a planned sale:
1. Pre-warm KV cache (cache product catalog before sale starts)
2. Upgrade to CF Workers Paid ($5/mo) day before
3. Monitor D1 write count in CF dashboard
4. Watch Resend daily limit — upgrade if needed
