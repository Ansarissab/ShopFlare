# SinglePageEcomm — Claude Instructions

## Project Overview
White-label serverless ecommerce for small businesses. $0 hosting cost.
Full Cloudflare stack. Open source. See CONTEXT.md for domain glossary.
See agents.md for parallel agent build orchestration plan.

## Key Files
- CONTEXT.md — domain glossary (read before any feature work)
- agents.md — parallel agent orchestration plan
- docs/adr/ — architectural decisions
- docs/architecture/cost-breakdown-normal.md — why it's $0
- lib/i18n/en.ts — ALL UI strings (never hardcode in components)
- lib/constants/index.ts — ORDER_STATUSES, CURRENCIES, PAYMENT_METHODS
- lib/schemas/ — Zod v4 schemas (shared client + CF Worker)
- db/schema.ts — Drizzle schema (source of all TypeScript types)
- worker/index.ts — Hono CF Worker entry

## Stack
- Next.js 16.2, React 19, Tailwind 4.3, shadcn/ui
- Cloudflare: Pages, Workers (Hono), D1 (Drizzle ORM), KV, R2, Access, Turnstile
- Stripe Checkout, Resend (BCC), Web Push API (PWA)
- Zod v4 (import from "zod/v4"), nanoid, browser-image-compression, @clack/prompts

## DRY Rules — ALWAYS FOLLOW (ENFORCED — see docs/architecture/dry-conventions.md)

Before writing code, check if a base/helper/type/schema/style already exists.
If it almost exists, EXTEND it — do not copy-paste. No "shit code", DRY only.
1. Colors: globals.css CSS vars only. Never hardcode hex in components.
2. Strings: lib/i18n/en.ts only. Never hardcode UI text in JSX.
3. Types: Infer from Drizzle schema. ALL composite types + ALL component prop
   interfaces live in lib/types/store.ts. Never declare `*Props` per-file.
4. Validation: lib/schemas/ Zod, shared client + Worker. Use OOP — .extend()
   (inherit), .merge()/compose, .pick() (form), .omit() (project). NEVER inline
   a schema in a route or form; derive from the base instead.
5. Constants: lib/constants/index.ts. Never inline ORDER_STATUSES etc.
6. Network: lib/api.ts only (apiGet/apiPost). NEVER raw fetch() or a per-file
   WORKER_URL. Custom headers via the { headers } option.
7. Styles: repeated Tailwind layout combos → lib/styles.ts (layout.*). Helpers →
   lib/utils. Backend order/product assembly → worker/lib (e.g. createOrder, used
   by BOTH the COD and Stripe paths). Reusable UI → shared components, composed.

## Security Rules — NEVER VIOLATE
- Secrets only in CF Worker env vars or .env.local (gitignored)
- D1 only accessible via CF Worker — never direct from client
- All public forms must have CF Turnstile
- Stripe webhooks must verify signature in CF Worker
- Admin routes protected by CF Access (not app-level auth)
- No raw card data ever — Stripe Checkout only

## Dynamic-First Rule
If a value can be stored in D1 and edited via Admin Dashboard → it MUST be.
Minimize redeployments. Merchants are not developers.

## No Redeploy Needed For
- Store name, tagline, logo, colors
- Products, variants, prices, stock
- Shipping rates, free threshold
- Coupons, discounts
- All policy pages
- WhatsApp number, contact email

## Caveman Mode
User prefers terse communication. No filler, no pleasantries.
See project memory for details.
