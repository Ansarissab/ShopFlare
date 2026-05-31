# Phase 2 — Admin Dashboard

## Scope

- Admin layout + sidebar navigation
- Dashboard overview (order stats, revenue, low stock)
- Product CRUD (create/edit/delete + R2 image upload)
- Order management (status updates, tracking number entry)
- Coupon management (create/edit + Stripe sync)
- Shipping config editor
- Store settings (name, logo, colors, contact, policies)
- Point of Sale (POS) — software cash register
- WhatsApp COD from POS

## Key files

- src/app/(admin)/admin/ routes
- src/components/admin/
- worker/routes/products.ts (implement)
- worker/routes/orders.ts (implement)
- worker/routes/coupons.ts (new)
- worker/routes/config.ts (implement)
