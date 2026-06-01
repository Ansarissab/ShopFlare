# Inventory Tracking

## Stock values

| Value | Meaning | Storefront display |
|---|---|---|
| > 5 | In stock | "In Stock" |
| 1–5 | Low stock | "Only N left" |
| 0 | Out of stock | "Out of Stock" + Notify Me |
| -1 | Unlimited | No stock indicator |

## Stock decrement on order creation

Stock is decremented in `createOrder` (shared by both COD and Stripe flows) using a conditional SQL update:

```sql
UPDATE size_options
SET stock = stock - qty
WHERE id = ? AND stock != -1
```

`stock = -1` (unlimited) is never decremented. For COD, the route pre-checks stock before calling `createOrder` and returns 422 if insufficient. For Stripe, a pending order row is written before the Stripe session, so stock is decremented at checkout initiation.

## Notify Me

Customer clicks "Notify Me" on an out-of-stock (`stock === 0`) size only.
Enters email or phone.
When merchant restocks (increases stock > 0 in admin):
CF Worker sends notification to all subscribers for that size option.
