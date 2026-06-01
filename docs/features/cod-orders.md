# Cash on Delivery

## Customer flow

1. Customer adds items to cart
2. Clicks "Cash on Delivery" (separate from Stripe checkout)
3. Fills form:
   - Full name (required)
   - Phone number (required)
   - Email (optional — for order updates)
   - Street address (required)
   - City (required)
   - Postal code (optional)
4. Turnstile widget (invisible) — token sent as `X-Turnstile-Token` header
5. Worker verifies token server-side via Cloudflare siteverify before any DB work
6. Stock checked for all items — returns 422 if any size is insufficient
7. Order created (status: `pending`) — shipping computed from store config, coupon applied and usage recorded if provided
8. Customer redirected to tracking page
9. Customer + merchant receive notifications

## Security

The Turnstile token is verified server-side in the CF Worker (`POST /api/orders/cod`) before any order row is written. No token or a failed siteverify check returns HTTP 403. `TURNSTILE_SECRET_KEY` must be set as a Worker secret.

## Merchant notification

Push notification to admin PWA + BCC email.

## Confirming COD orders

Admin → Orders → COD order → Mark Confirmed
This changes status to `confirmed` and notifies customer.

## On delivery

After cash collected:
Admin → Orders → Mark Delivered
Inventory already decremented at order creation.

## Order tracking

Customers track orders at `/track/[orderNumber]`. The form collects an email or phone alongside the order number; the contact value is passed to the API as `?c=` for best-effort identity confirmation.

`GET /api/orders/track/:orderNumber` returns order status, totals, and item snapshots. The order number (format `ORD-XXXXXX`) is the only public identifier — no internal IDs are exposed.

## Customer cancellation

Customers can cancel an order while it is `pending` or `confirmed` via `POST /api/orders/:orderNumber/cancel`. Orders in any other status (`processing`, `shipped`, `delivered`, `cancelled`) are rejected with 422.
