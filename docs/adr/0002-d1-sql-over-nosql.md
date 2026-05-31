---
status: accepted
date: 2026-05-31
---
# ADR 0002: D1 (SQL) Over NoSQL for Orders and Products

## Context
Needed a database for orders, products, coupons, reviews. Options: Cloudflare D1 (SQLite/SQL), Firebase Firestore (NoSQL), or Upstash Redis.

## Decision
Use Cloudflare D1 with Drizzle ORM.

## Reasons
- Orders → items → products → variants is relational; SQL joins trivial, NoSQL painful
- Analytics queries (revenue by day, top products) are natural SQL, awkward in NoSQL
- ACID transactions needed for stock decrement and coupon redemption
- Drizzle schema is single source of truth; TypeScript types auto-generated
- D1 free tier exceeds Firestore free tier by 500× on reads

## Tradeoffs
- SQL schema requires migrations (managed by Drizzle)
- No real-time listeners (not needed; admin polls every 30s)
