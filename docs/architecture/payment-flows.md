# Payment Flows

## Stripe Checkout (cards, Apple Pay, Google Pay)

```
1. Customer selects items + applies coupon
2. Client → POST /api/stripe/checkout-session
   body: { items: [{stripePriceId, qty}], orderId, couponCode? }
3. CF Worker:
   - Validates items against D1
   - Checks stock (D1 transaction)
   - Creates Stripe Checkout Session
   - Returns { url }
4. Client redirects to Stripe URL
5. Customer completes payment
6. Stripe → POST /api/stripe/webhook (checkout.session.completed)
7. CF Worker:
   - Verifies Stripe signature
   - Checks stripe_events (idempotency)
   - Decrements stock (D1 transaction)
   - Creates order in D1
   - Sends Resend email (BCC merchant)
   - Fires Web Push to merchant
   - Logs to CF Analytics Engine
8. Stripe redirects to /track/ORD-XXXXX?session_id=...
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
