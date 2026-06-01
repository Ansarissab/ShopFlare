# Coupon Codes

## Validation endpoint

`POST /api/coupons/validate`

Used by the cart to check a code before checkout. Request:

```json
{ "code": "SAVE10", "subtotalCents": 5000 }
```

Response on success: `{ "valid": true, "discountCents": 500 }`
Response on failure: `{ "valid": false, "discountCents": 0, "message": "..." }`

The same rules that `createOrder` uses are applied here (`evaluateCoupon` is shared).

## Validity rules

| Rule | Behaviour |
| --- | --- |
| `active = false` | Rejected — coupon not found or inactive |
| `expiresAt` in the past | Rejected — coupon has expired |
| `minOrderCents` not met | Rejected — minimum order message returned |
| `usageLimit` reached (`usedCount >= usageLimit`) | Rejected — usage limit reached |
| `usageLimit = null` | No cap — unlimited uses |

## Discount types

| `type` | Computation |
| --- | --- |
| `percentage` | `floor(subtotal × value / 100)` |
| `fixed` | `value` (cents) |

If `maxDiscountCents` is set, the computed discount is capped at that value.

## Order creation

When a valid coupon is applied during order creation (`createOrder`):

1. `discountCents` is computed and stored on the order row.
2. A row is inserted into `coupon_uses` (records `couponId`, `orderId`, `customerEmail`, `customerPhone`).
3. `coupons.used_count` is incremented atomically.

This happens for both COD and Stripe orders.

## Stripe integration

If a coupon has a `stripePromotionCodeId`, the promotion code is pre-applied to the Stripe Checkout session so the discount is visible and enforced inside Stripe as well.
