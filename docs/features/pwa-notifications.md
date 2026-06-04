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

---

## Customer Push Notifications (Phase 10)

Customers can opt into push notifications for order status updates.

### How customers enable notifications

1. Go to the order tracking page `/track/[orderNumber]`
2. Tap "Get order updates" → tap Enable
3. Browser asks permission → tap Allow
4. Done. Push notifications arrive when order status changes to Shipped or Delivered.

Also offered on the checkout success page immediately after placing an order.

### What customers receive

- **Order shipped**: "Your order ORD-XXXXX has been shipped!"
- **Order delivered**: "Your order ORD-XXXXX has been delivered!"
- Tapping the notification opens the tracking page

### Back-in-stock push

Customers who tap "Notify Me" on an out-of-stock item can opt into push alerts (in addition to email). When stock is restocked, they receive a push notification.

### iOS requirements

Push only works for Home Screen web apps (iOS 16.4+). When on iOS, customers see Add-to-Home-Screen instructions first.

### Cost (customer push)

Zero. Customer push uses the same VAPID/FCM/APNs infrastructure as merchant push.
