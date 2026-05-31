---
status: accepted
date: 2026-05-31
---
# ADR 0005: Single Email With BCC to Merchant

## Context
Need to notify both Customer and Merchant when an Order is confirmed. Two separate emails would double Resend quota usage.

## Decision
Send one transactional email TO Customer, BCC Merchant's configured email. One Resend credit per Order.

## Reasons
- Resend free tier: 3,000 emails/month = 3,000 orders/month at 1 email each
- BCC is native to Resend API — no additional complexity
- Merchant receives identical Order details as Customer
- Maximum 2 emails per Order lifecycle: confirmation + shipping update (tracking number)

## Tradeoffs
- Merchant sees customer-facing email format (not a separate internal format)
- If merchant wants different format from customer: requires separate send (doubles quota)
