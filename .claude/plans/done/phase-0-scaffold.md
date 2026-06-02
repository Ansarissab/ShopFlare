# Phase 0 — Project Scaffold

## Context
Empty repo with only docs/ADRs committed. Need to scaffold the full Next.js 16.2 + Cloudflare stack before any feature work. This is the foundation every subsequent phase builds on.

## Plan Folder Structure (to create)
```
.claude/plans/
  active/   ← current phase in progress
  done/     ← completed phases
  proposed/ ← upcoming phases 1–4
```

## Node Version
Node 24 LTS (latest as of May 2026). User uses **mise** for version management.
`.tool-versions` file: `node 24` (mise native format, also compatible with asdf)

## Phase 0 Steps (one commit per step)

### Step 1 — Plan folder structure + .node-version
- Create `.claude/plans/active/`, `done/`, `proposed/`
- Move this plan to `.claude/plans/active/phase-0-scaffold.md`
- Create proposed plan stubs for phases 1–4
- Create `.tool-versions` → `node 24`
- **Commit:** `chore: add plan folder structure and pin Node 24 LTS via mise`

### Step 2 — Next.js 16.2 init
```bash
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --turbopack
```
- Confirm Next.js 16.2, React 19, Tailwind 4.3
- **Commit:** `chore: init Next.js 16.2 with App Router, TypeScript, Tailwind`

### Step 3 — Cloudflare + Worker deps
```bash
npm install hono @cloudflare/next-on-pages wrangler --save-dev
npm install @cloudflare/workers-types --save-dev
```
Create `wrangler.toml`:
```toml
name = "shopflare-worker"
main = "worker/index.ts"
compatibility_date = "2026-05-31"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "store-db"
database_id = "placeholder"

[[kv_namespaces]]
binding = "KV"
id = "placeholder"

[[r2_buckets]]
binding = "R2"
bucket_name = "store-images"
```
Create `worker/index.ts` (Hono skeleton with stub routes).
- **Commit:** `chore: add Cloudflare Workers + Hono setup with wrangler config`

### Step 4 — Drizzle ORM + D1
```bash
npm install drizzle-orm
npm install drizzle-kit --save-dev
```
Create:
- `worker/db/schema.ts` — full D1 schema (products, variants, size_options, orders, order_items, coupons, coupon_uses, reviews, notify_me, store_config, stripe_events, push_subs)
- `worker/db/index.ts` — Drizzle client init
- `drizzle.config.ts` — points to D1
- **Commit:** `feat(db): add Drizzle ORM schema for D1 — all tables`

### Step 5 — shadcn/ui init + globals.css
```bash
npx shadcn@latest init
```
- Configure `globals.css` with full CSS var system (light/dark, --store-primary, --store-accent)
- Tailwind v4 `@theme` block with all color tokens
- Install base shadcn components: Button, Card, Badge, Input, Select, Dialog, Sheet, Tabs, Separator, Sonner (toast)
- **Commit:** `chore: init shadcn/ui + Tailwind theme with light/dark CSS vars`

### Step 6 — Project structure + lib skeleton
Create empty files/folders with barrel exports:
```
src/
  app/
    (store)/          page.tsx, layout.tsx stubs
    (admin)/          page.tsx, layout.tsx stubs
  components/
    ui/               (shadcn lives here)
    store/            .gitkeep
    admin/            .gitkeep
  lib/
    types/            index.ts (inferred from Drizzle)
    schemas/          index.ts (Zod v4 stubs)
    constants/        index.ts (ORDER_STATUSES, CURRENCIES, PAYMENT_METHODS)
    i18n/             en.ts (all UI strings placeholder)
    utils/            index.ts
worker/
  routes/             stripe.ts, products.ts, orders.ts, config.ts (stubs)
```
- **Commit:** `chore: scaffold project structure — lib, components, worker routes`

### Step 7 — Zod v4 + other deps
```bash
npm install zod nanoid
npm install @stripe/stripe-js stripe
npm install resend
npm install browser-image-compression
npm install zustand
npm install react-hook-form @hookform/resolvers
npm install web-push
npm install @clack/prompts
```
- **Commit:** `chore: add all project dependencies`

### Step 8 — Env templates + gitignore + README
- `.env.local.example` — all NEXT_PUBLIC_ vars documented
- `.dev.vars.example` — all CF Worker secret vars documented
- Update `.gitignore` — ensure `.env.local`, `.dev.vars` excluded
- Update `README.md` — project overview, setup link, stack badge, build status
- `_headers` (public/) — CF Pages security headers (CSP, X-Frame-Options etc.)
- `public/robots.txt` stub
- **Commit:** `chore: env templates, gitignore, security headers, README`

### Step 9 — Proposed phase plan stubs
Create in `.claude/plans/proposed/`:
- `phase-1-foundation.md` — lib/types, constants, i18n, CF Worker routes, theme
- `phase-2-store.md` — product UI, cart, Stripe checkout, COD, WhatsApp, tracking
- `phase-3-admin.md` — dashboard, product CRUD, order mgmt, coupons, POS
- `phase-4-polish.md` — reviews, notify-me, push/email, SEO, setup wizard, docs
- **Commit:** `docs: add proposed phase plans 1–4`

## README Update Strategy
Update README after every phase completion:
- Progress checklist (✅ done, 🔄 in progress, ⏳ planned)
- Stack badges
- Setup link (once wizard exists)

## Verification
After Phase 0:
```bash
npm run dev          # Next.js starts on localhost:3000
npx wrangler dev     # CF Worker starts
npm run db:generate  # Drizzle generates migration SQL
```
No errors. Basic pages render. Worker responds on /api/ping.

## Files Changed
New files only (empty repo). Key files:
- `.node-version`
- `wrangler.toml`
- `drizzle.config.ts`
- `worker/db/schema.ts` ← most critical, defines all data
- `src/lib/constants/index.ts`
- `src/lib/i18n/en.ts`
- `public/_headers`
- `.env.local.example`
- `.dev.vars.example`
- `README.md`
- `.claude/plans/` structure
