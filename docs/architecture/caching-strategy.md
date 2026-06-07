# Caching Strategy

## Cache layers

```text
Request
  → Cloudflare CDN (static JS/CSS/Next.js chunks — long-lived, immutable)
    → Cloudflare CDN (R2 product images — immutable per content-addressed key)
      → CF Worker + D1 (dynamic API — always fresh via ETag/304)
```

## Static assets

Next.js generates hashed chunk filenames. Served by Cloudflare Workers Static Assets
(CDN) with `Cache-Control: public, max-age=31536000, immutable`. A new deploy
invalidates these automatically because the hash changes.

## Product images (R2)

Images are stored in R2 under a `nanoid` key (`products/{productId}/{variantId}/{imageId}.{ext}`).
The key never changes for the same image. The Worker serves them with:

```http
Cache-Control: public, max-age=31536000, immutable
```

Deleting and re-uploading creates a new key, so old cached URLs stay valid and new ones are
fresh immediately.

## Dynamic API responses (ETags)

Public read endpoints use `Cache-Control: no-cache` (not `no-store`) + `ETag`. The browser
revalidates on every load with `If-None-Match`; the Worker returns `304 Not Modified` when
nothing changed (cheap — no body sent). When data changes the Worker returns `200` with a
fresh body.

| Endpoint | ETag inputs |
| --- | --- |
| `GET /api/config/store` | `COUNT(*)` + `MAX(updated_at)` of `store_config` rows |
| `GET /api/products` | `COUNT(*)` + `MAX(updated_at)` of active products + `dataVersion` |
| `GET /api/products/:id` | product `updated_at` + `dataVersion` |
| `GET /api/pages/:slug` | page `updated_at` + `dataVersion` |

### Data version bump

Every admin write route (product CRUD, variant/size/image CRUD, config, coupons, pages) calls
`bumpDataVersion()` (`worker/lib/version.ts`) after a successful mutation. This increments a
`dataVersion` counter in `store_config` and updates its `updated_at`. The version is included
in ETag fingerprints so **deletes also invalidate** ETags (deleting a row doesn't update any
surviving row's `updated_at`, but it bumps `dataVersion`).

### Cross-tab invalidation (BroadcastChannel)

When an admin save succeeds on the client, it posts to `shopflare:data-updated`
(`DATA_UPDATED_CHANNEL`). Hooks that subscribe to this channel (`useStoreConfig`,
`useApiResource` with `refetchOnChannel: true`) silently refetch in all open tabs — so the
storefront reflects changes made in the admin tab immediately without a full page reload.

## Admin session tokens (no cache needed)

Admin auth uses stateless HMAC session tokens (`worker/lib/admin-session.ts`), signed and
verified with `ADMIN_SESSION_SECRET`. There is no external key fetch and nothing to cache —
verification is a local HMAC check per request. (This replaced the former CF Access JWKS
fetch/cache; see ADR 0010.)

## What is NOT cached in KV

Unlike early drafts, the product catalog and store config are **not** cached in KV.

The ETag + `no-cache` + D1 approach is simpler, avoids stale-read windows after admin writes, and D1 latency is well within acceptable limits for the expected request volume.
