# Caching Strategy

## Cache layers

```
Request
  → Cloudflare CDN (static assets: JS, CSS, images)
    → CF KV (product catalog, theme, config)
      → CF Worker
        → CF D1 (source of truth)
```

## What gets cached in KV

| Key | TTL | Content |
|---|---|---|
| `products:all` | 10min | Full product catalog with variants |
| `product:{id}` | 10min | Single product |
| `config:store` | 1hr | Store name, logo, contact |
| `config:theme` | 1hr | Primary/accent colors |
| `config:shipping` | 1hr | Shipping rates |
| `order:{id}:status` | 30s | Order status for tracking page |

## Cache invalidation

Product updated in admin → CF Worker deletes `products:all` and `product:{id}` from KV.
Store config updated → CF Worker deletes `config:store` and `config:theme`.

## Image caching

R2 images served with:
```
Cache-Control: public, max-age=31536000, immutable
```
Images use versioned URLs (`product-v2.webp`) — change version on update.

## Cache miss rate

Expected: <1% during normal operations.
Cold start (first request after deploy): single cache miss per key.
