---
status: accepted
date: 2026-05-31
---
# ADR 0001: Full Cloudflare Stack Over Firebase + GitHub Pages

## Context
Project requires zero hosting cost, global CDN, webhook support, and a secure admin. Initial consideration: GitHub Pages (static) + Firebase (DB + Auth).

## Decision
Use Cloudflare Pages, Workers, D1, KV, R2, Access, Turnstile, and Web Analytics exclusively. No Firebase.

## Reasons
- Cloudflare D1 free tier: 25M reads/day vs Firebase Firestore 50K reads/day (500× better)
- R2 has zero egress fees; Firebase Storage charges per download — unsustainable at scale
- CF Workers receive webhooks; GitHub Pages cannot
- CF Access replaces Firebase Auth with zero-trust at the edge, no SDK
- Single provider = single dashboard, single support surface
- CF WAF + DDoS protection included free; GitHub Pages has neither

## Tradeoffs
- D1 is newer than Firestore; less community tooling
- No Firestore real-time listeners; replaced by 30s admin polling
- CF Workers free tier: 100K req/day; must upgrade to $5/mo plan at scale (still near $0)
