---
status: accepted
date: 2026-05-31
---
# ADR 0006: Stripe Checkout Over Raw Card Capture

## Context
Payment collection options: Stripe Checkout (hosted page), Stripe Elements (embedded), raw card capture via direct API.

## Decision
Use Stripe Checkout (hosted redirect) for all card payments.

## Reasons
- Raw card capture on a static site = PCI SAQ D scope (most complex)
- Stripe Checkout = PCI SAQ A (simplest, Stripe handles everything)
- Stripe Checkout supports all payment methods, saved cards, Apple Pay, Google Pay
- No card data ever touches our servers or client bundle
- Works on Cloudflare Pages static export without server-side rendering
- Pakistan: Stripe Checkout supports local cards and international cards

## Tradeoffs
- Customer redirected away from store to Stripe-hosted page
- Less control over checkout UI (Stripe branding visible, though customizable)
