# PWA Push Notifications

## Setup (merchant — one time)

1. Open `/admin` in Chrome/Safari on your phone
2. Browser prompts to "Add to Home Screen" → tap Add
3. Open from home screen
4. First time: browser asks permission for notifications → tap Allow
5. Done. You'll receive push notifications for every new order.

## How it works

When an order is confirmed:
1. CF Worker sends push notification via Web Push API
2. Backed by Google FCM / Apple APNs
3. Notification delivered even if phone screen is off
4. If phone is offline → notification queued → delivered when back online

## Notification content

```
🛍️ New Order — ORD-XXXXX
[Product] × [Qty] — ₨[Amount]
Payment: Stripe / COD / WhatsApp
```

## Cost

Zero. Web Push API is free.
FCM (Google) and APNs (Apple) are free for push delivery.

## VAPID keys

Generate once:
```bash
npx web-push generate-vapid-keys
```
Set both keys via `wrangler secret put`.
