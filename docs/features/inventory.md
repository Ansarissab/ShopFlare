# Inventory Tracking

## Stock values

| Value | Meaning | Storefront display |
|---|---|---|
| > 5 | In stock | "In Stock" |
| 1–5 | Low stock | "Only N left" |
| 0 | Out of stock | "Out of Stock" + Notify Me |
| -1 | Unlimited | No stock indicator |

## Atomic stock decrement

Stock decremented using D1 transaction on order creation.
Concurrent orders cannot both succeed if only 1 item remains.

```typescript
// From CF Worker (simplified)
await db.transaction(async (tx) => {
  const item = await tx.select().from(sizeOptions).where(eq(sizeOptions.id, id))
  if (item.stock !== -1 && item.stock < qty) throw new Error('OUT_OF_STOCK')
  await tx.update(sizeOptions).set({ stock: item.stock - qty })
})
```

## Notify Me

Customer clicks "Notify Me" on out-of-stock size.
Enters email or phone.
When merchant restocks (increases stock > 0 in admin):
CF Worker sends notification to all subscribers for that size option.
