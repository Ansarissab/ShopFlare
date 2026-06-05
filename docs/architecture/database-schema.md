# Database Schema

All tables in Cloudflare D1 (SQLite). Schema defined in `worker/db/schema.ts`.
TypeScript types auto-inferred — never manually duplicated.

## Tables

| Table | Purpose |
|---|---|
| `products` | Product catalog |
| `variants` | Color/style variants per product (max 5) |
| `size_options` | Size + price + stock per variant |
| `product_images` | Images per variant (R2 keys + URLs) |
| `orders` | Customer orders (all payment methods) |
| `order_items` | Line items per order + product snapshot |
| `coupons` | Discount codes (synced to Stripe) |
| `coupon_uses` | Redemption tracking for abuse prevention |
| `reviews` | Verified-purchase reviews (admin-moderated) |
| `notify_me` | Restock alert subscriptions |
| `store_config` | Key-value store for merchant settings |
| `stripe_events` | Processed webhook event IDs (idempotency) |
| `push_subscriptions` | Web Push endpoints — `admin` kind (merchant order alerts) + `order` kind (customer, tied to an order number) |

## Key design decisions

- All prices in **cents** (integer) — no floating point money bugs
- `stock = -1` means unlimited (digital goods, made-to-order)
- `order_items.snapshot` — JSON of product name/image at time of purchase (survives product edits)
- `store_config` — key-value table, no schema migration needed for new settings
- `stripe_events.event_id` — unique constraint prevents duplicate webhook processing
