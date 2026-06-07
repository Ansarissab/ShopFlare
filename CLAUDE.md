# ShopFlare — Claude Instructions

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
- Cloudflare: **two Workers** — frontend (Next.js SSR via `@opennextjs/cloudflare`,
  worker name `shopflare-web`) + API (Hono, `shopflare-worker`) — D1 (Drizzle ORM),
  KV, R2, Turnstile. NOT Pages, NOT static export, NOT CF Access (see Deployment).
- Stripe Checkout, Resend (BCC), Web Push API (PWA)
- Zod v4 (import from "zod/v4"), nanoid, browser-image-compression, @clack/prompts

## Deployment (CF go-live — see docs/setup/cloudflare-guide.md)
- App is SSR (proxy/middleware + dynamic routes) → NOT a static export. The frontend
  runs as its own Worker via OpenNext: `pnpm web:deploy` (config `wrangler.frontend.jsonc`,
  `open-next.config.ts`). API worker: `pnpm worker:deploy` (`wrangler.toml`).
- Two separate `*.workers.dev` hosts → cookies can't be shared (public-suffix domain),
  so the admin token travels as an `Authorization: Bearer` header, not a cookie.
- CF resources: D1 `shopflare-db0`, KV (binding `KV`), R2 `shopflare-images0`. Bindings
  in code/config are `DB`/`KV`/`R2` (never rename them).
- `$0 hosting`: stay on the Workers FREE plan (over-limit = HTTP 429, never billed).
  R2 requires a card on file but stays $0 under free limits. Set CF budget alerts.

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
- All public forms must have CF Turnstile (incl. admin login). Enforced in
  production only; `verifyTurnstile` skips entirely when `ENVIRONMENT=development`
  (local `wrangler dev` + the integration suite), so local never needs a real
  token/secret. DRY: that single bypass covers every route + the login.
- Stripe webhooks must verify signature in CF Worker
- Admin API gated by an HMAC session token (app-level password): secrets
  `ADMIN_PASSWORD` + `ADMIN_SESSION_SECRET`; `requireAdmin` verifies the Bearer
  token, fails closed. (CF Access can't path-scope `/admin` on `*.workers.dev`.)
- No raw card data ever — Stripe Checkout only

## Testing & CI

- `pnpm verify` (alias `pnpm run ci`) is the full gate (Rails `bin/ci` style,
  `scripts/ci.mjs`): typecheck → lint → unit+coverage → integration → build, fail-fast.
  `--quick` skips integration+build; `--no-build` skips build. Note: bare `pnpm ci` is a
  reserved pnpm builtin — use `pnpm verify` or `pnpm run ci`. E2E/visual/a11y are separate
  (`pnpm test:e2e`, need a dev server).
- **Coverage gate = unit project only, 95%** (`pnpm test:coverage` =
  `vitest run --project unit --coverage`). Worker routes run in the miniflare/workerd pool
  where v8 can't instrument them → they're covered **behaviorally** by the integration
  suite (`pnpm test:integration`), not by line %. See `docs/adr/0008-coverage-gate-unit-only.md`.
- Excluded from the unit gate: `src/app/**`, `src/components/ui/**`, and the CF-runtime
  `worker/lib/{orders,stripe,push,analytics,access,categories,notify,products}.ts`. Pure
  helpers stay in scope (e.g. `worker/lib/admin-session.ts` IS unit-tested).
- Every fixed UI/UX bug gets a permanent regression test in the right layer (see
  `docs/plans/done/phase-16-comprehensive-testing.md`).

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
