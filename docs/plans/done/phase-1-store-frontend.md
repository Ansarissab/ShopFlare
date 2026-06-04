# Phase 1 — Store Frontend

## Scope

- Product listing page (auto-switch: 1 product = hero, 2+ = grid)
- Product detail page with Gumroad-style layout
- Variant/size selector with live price update
- Image carousel (variant-specific)
- Cart (Zustand + localStorage)
- Free shipping progress bar
- Stripe Checkout integration
- COD checkout form (Zod validation)
- WhatsApp order flow (pre-filled deep link)
- Order tracking page (/track/[orderId])
- Customer cancel flow
- Notify Me (out-of-stock capture)

## Key files

- src/app/(store)/ routes
- src/components/store/
- src/hooks/useCart.ts
- worker/routes/stripe.ts (implement)
- worker/routes/orders.ts (implement)
