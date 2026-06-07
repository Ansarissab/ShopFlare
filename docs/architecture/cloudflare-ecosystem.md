# Cloudflare Ecosystem

Every service used and why.

## Workers (two of them)
Serverless functions on the edge. Free: 100K requests/day account-wide (over-limit =
429, never billed); $5/mo for Workers Paid.
- **Frontend Worker** (`shopflare-web`): Next.js SSR via `@opennextjs/cloudflare`. Serves
  all UI; static assets (JS/CSS/img) are free + unmetered Workers Static Assets.
- **API Worker** (`shopflare-worker`): Hono. Stripe webhooks, all DB access, all Stripe calls.

## D1
SQLite at the edge. Free: 5 GB, 5M row-reads/day, 100K row-writes/day.
Accessed only from the API Worker — never directly from client.

## KV
Key-value cache. Free: 100K reads/day.
Used for: product catalog cache (TTL 10min), theme cache, Stripe price cache.

## R2
Object storage. Free: 10GB storage, zero egress fees. **Requires a card on file**
to enable (CF policy) but stays $0 under the free tier.
Used for: product images, review photos.
Images served via the API Worker `/cdn/*` (long-cached).

## Admin auth (app-level)
No Cloudflare Access / Zero Trust (it can't path-scope `/admin` on `*.workers.dev`).
Instead: `/api/admin/login` checks `ADMIN_PASSWORD` and issues an HMAC session token
(`ADMIN_SESSION_SECRET`); `requireAdmin` verifies the Bearer token on every admin
request. See ADR 0010.

## Turnstile
Bot protection CAPTCHA (invisible). Free, unlimited.
Used on: COD form, notify-me form, review form, coupon field.

## Web Analytics
Privacy-first page analytics. Free. No cookie consent needed.
Add one script tag. Dashboard in CF dashboard.

## Analytics Engine
Custom event tracking. Free: 100K data points/day.
Used for: order events, revenue tracking, product popularity.

## WAF
Web Application Firewall. Free tier blocks known bad actors.
Custom rules for: rate limiting coupon attempts, blocking scraper UAs.
