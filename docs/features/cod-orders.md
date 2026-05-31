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
4. Turnstile bot check (invisible)
5. Order created (status: `pending`)
6. Customer redirected to tracking page
7. Customer + merchant receive notifications

## Merchant notification

Push notification to admin PWA + BCC email.

## Confirming COD orders

Admin → Orders → COD order → Mark Confirmed
This changes status to `confirmed` and notifies customer.

## On delivery

After cash collected:
Admin → Orders → Mark Delivered
Inventory already decremented at order creation.
