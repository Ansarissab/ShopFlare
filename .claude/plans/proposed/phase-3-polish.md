# Phase 3 — Polish + Features

## Scope

- Reviews/ratings (submit + admin moderation)
- Notify Me — restock email/WhatsApp alerts
- Resend email (order confirmation + BCC merchant)
- PWA Web Push (merchant order notifications)
- Sitemap.xml (dynamic, from D1)
- JSON-LD structured data (Product + AggregateRating)
- CF Analytics Engine events (orders, revenue)
- Admin analytics view
- Light/dark mode toggle
- PWA manifest + service worker

## Key files

- worker/routes/reviews.ts (new)
- worker/routes/notify.ts (new)
- worker/lib/email.ts (Resend)
- worker/lib/push.ts (Web Push)
- src/app/sitemap.ts
