# Payment Flows

## Stripe Checkout (cards, Apple Pay, Google Pay)

```
1. Customer selects items + applies coupon
2. Client → POST /api/stripe/checkout-session
   body: { items: [{stripePriceId, quantity}], couponCode? }
3. CF Worker:
   - Rate-limit + Turnstile gate
   - Creates a PENDING order in D1 (stock reserved, coupon counted)
   - Stores orderId in Stripe session metadata so the webhook can confirm it
   - Creates Stripe Checkout Session (line_items from stripePriceId)
   - Persists stripeSessionId on the order row
   - Returns { url }
4. Client redirects to Stripe URL
5. Customer completes payment on Stripe hosted page
6. Stripe → POST /api/stripe/webhook (checkout.session.completed)
7. CF Worker:
   - Verifies Stripe signature (constructEventAsync)
   - Checks stripe_events table (idempotency guard — skips duplicate event.id)
   - Updates order status pending→confirmed + populates customer details
   - Writes stripe_events row (idempotency record)
   - Fires notifyNewOrder via waitUntil (Resend email BCC merchant + Web Push)
8. Stripe redirects customer to /checkout/success?session_id=...

If the session expires without payment:
6b. Stripe → POST /api/stripe/webhook (checkout.session.expired)
7b. CF Worker:
    - Verifies signature + idempotency guard
    - Cancels the order (only if still pending — guard against clobbering confirmed)
    - Calls releaseOrderInventory: restores stock + reverts coupon usage
    - Writes stripe_events row
```

## COD (Cash on Delivery)

```
1. Customer fills COD form (name, phone, address)
2. Turnstile verification
3. Client → POST /api/orders/cod
   body: { items, shippingAddress, couponCode? }
4. CF Worker:
   - Validates Zod schema
   - Checks stock (D1 transaction)
   - Creates order in D1 (status: pending)
   - Sends Resend email (BCC merchant)
   - Fires Web Push to merchant
5. Client redirected to /track/ORD-XXXXX
```

## WhatsApp Order

```
1. Customer selects product + variant + size
2. Clicks "Order on WhatsApp"
3. Client generates wa.me URL:
   wa.me/PHONE?text=Order: [details]
4. WhatsApp opens on customer device
5. Customer sends message to merchant
6. Merchant manually creates order in Admin POS
```

## POS / In-Person Cash

```
1. Merchant selects items in admin POS
2. Enters customer phone
3. Confirms payment received
4. CF Worker creates order (status: confirmed, payment: in_person_cash)
5. Optionally: merchant taps "Send WhatsApp Receipt"
   → wa.me link opens with order summary addressed to customer's phone
```
