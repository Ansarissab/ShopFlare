---
status: accepted
date: 2026-05-31
---
# ADR 0003: Dynamic Config via D1 — Minimize Redeployments

## Context
White-label store must let Merchant change name, logo, colors, products, policies, shipping rates without technical knowledge or redeployment.

## Decision
All non-secret store configuration stored in D1 and served via CF Worker endpoints. Next.js static bundle contains no merchant-specific values beyond the Cloudflare Worker URL.

## Reasons
- Redeployment creates friction for Merchants who are not developers
- Colors, logo, policies change frequently; baking them into build is impractical
- Stripe publishable key served via /api/public-config endpoint (not baked into bundle) enables key rotation without rebuild
- D1 KV cache layer means dynamic config has near-static performance

## Tradeoffs
- Initial page load makes one additional fetch for public config
- CSS variables applied client-side; brief flash of default colors mitigated by CSS var defaults in globals.css
- Secrets (Stripe secret key, Resend key) still require CF Worker env var update (one-time or rare)
