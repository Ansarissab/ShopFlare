---
status: accepted
date: 2026-05-31
---
# ADR 0004: PWA Web Push for Merchant Notifications Over Telegram/WhatsApp

## Context
Merchant needs instant notification when an Order is placed. Options: Telegram bot, WhatsApp Business API, email, PWA Web Push.

## Decision
PWA Web Push via Web Push API + VAPID keys. Merchant adds /admin to home screen as PWA.

## Reasons
- Telegram requires VPN in Pakistan — unacceptable friction
- WhatsApp Business API charges per business-initiated message (~$0.015/conversation) — not $0
- Email (Resend) has monthly quota; reserving for customer-facing transactional emails
- Web Push: backed by Google FCM / Apple APNs, queues while offline, $0 forever
- PWA: no app store, works on all devices, single codebase

## Tradeoffs
- Merchant must add admin to home screen (one-time setup, guided in Setup Wizard)
- Requires HTTPS (already enforced by Cloudflare Pages)
