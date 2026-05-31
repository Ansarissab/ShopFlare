# Cloudflare Ecosystem

Every service used and why.

## Pages
Static Next.js hosting. Global CDN. Unlimited bandwidth on free tier.
Auto-deploys on `git push`.

## Workers
Serverless functions. Receives Stripe webhooks. All DB access. All Stripe API calls.
Free: 100K requests/day. $5/month for 10M requests.

## D1
SQLite at the edge. Free: 25M reads/day, 50K writes/day.
Accessed only from CF Worker — never directly from client.

## KV
Key-value cache. Free: 100K reads/day.
Used for: product catalog cache (TTL 10min), theme cache, Stripe price cache.

## R2
Object storage. Free: 10GB storage, zero egress fees.
Used for: product images, review photos.
Images served via Cloudflare CDN automatically.

## Access
Zero-trust auth. Protects `/admin/*` with email OTP.
Free for up to 50 users. No auth code required.

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
