# Graph Report - .  (2026-06-04)

## Corpus Check
- Large corpus: 244 files · ~99,699 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder, or use --no-semantic to run AST-only.

## Summary
- 621 nodes · 969 edges · 75 communities (71 shown, 4 thin omitted)
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 88 edges (avg confidence: 0.83)
- Token cost: 16,700 input · 7,300 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Admin UI & Forms|Admin UI & Forms]]
- [[_COMMUNITY_Worker Backend & Routes|Worker Backend & Routes]]
- [[_COMMUNITY_Store Frontend & Cart|Store Frontend & Cart]]
- [[_COMMUNITY_Architecture Docs & CF Platform|Architecture Docs & CF Platform]]
- [[_COMMUNITY_Feature Docs & API Design|Feature Docs & API Design]]
- [[_COMMUNITY_Checkout & Order Tracking|Checkout & Order Tracking]]
- [[_COMMUNITY_API Endpoints & Config|API Endpoints & Config]]
- [[_COMMUNITY_Analytics Dashboard|Analytics Dashboard]]
- [[_COMMUNITY_Shared UI Components|Shared UI Components]]
- [[_COMMUNITY_Email Service|Email Service]]
- [[_COMMUNITY_Domain Concepts|Domain Concepts]]
- [[_COMMUNITY_Coverage UI Scripts|Coverage UI Scripts]]
- [[_COMMUNITY_DB Migrations & Tax|DB Migrations & Tax]]
- [[_COMMUNITY_CF Access Auth|CF Access Auth]]
- [[_COMMUNITY_Policy & Notification UI|Policy & Notification UI]]
- [[_COMMUNITY_Coverage Prettify|Coverage Prettify]]
- [[_COMMUNITY_API Resource Hooks|API Resource Hooks]]
- [[_COMMUNITY_Product Cards & SEO|Product Cards & SEO]]
- [[_COMMUNITY_Notify Me Feature|Notify Me Feature]]
- [[_COMMUNITY_Project Docs & Agents|Project Docs & Agents]]
- [[_COMMUNITY_DB Migration Chain|DB Migration Chain]]
- [[_COMMUNITY_Image Carousel|Image Carousel]]
- [[_COMMUNITY_Caching & Fingerprinting|Caching & Fingerprinting]]
- [[_COMMUNITY_Coverage Block Navigation|Coverage Block Navigation]]
- [[_COMMUNITY_ADR Stack Decisions|ADR Stack Decisions]]
- [[_COMMUNITY_Admin Dashboard Stats|Admin Dashboard Stats]]
- [[_COMMUNITY_PWA Push Notifications|PWA Push Notifications]]
- [[_COMMUNITY_Resend BCC Strategy|Resend BCC Strategy]]

## God Nodes (most connected - your core abstractions)
1. `cn()` - 46 edges
2. `Skeleton()` - 24 edges
3. `createDb()` - 23 edges
4. `formatPrice()` - 22 edges
5. `useApiResource()` - 16 edges
6. `apiPost()` - 16 edges
7. `CONTEXT.md — Domain glossary for ShopFlare` - 16 edges
8. `Badge()` - 15 edges
9. `useStoreConfig()` - 14 edges
10. `apiDelete()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `Variant — color/style configuration of a Product; max 5 per Product` --shares_data_with--> `variants — D1 table: color/style variants per product`  [INFERRED]
  CONTEXT.md → worker/db/migrations/0000_neat_maddog.sql
- `Order — confirmed purchase intent; has Order Number, status lifecycle, payment method` --shares_data_with--> `orders — D1 table: core order record with payment, customer, totals, stripe IDs, tracking`  [INFERRED]
  CONTEXT.md → worker/db/migrations/0000_neat_maddog.sql
- `Product — sellable catalog item with variants; typically 1-5 per store` --shares_data_with--> `products — D1 table: catalog products with stripe_product_id`  [INFERRED]
  CONTEXT.md → worker/db/migrations/0000_neat_maddog.sql
- `Size Option — specific size within a Variant with price_cents, stock, SKU, stripe_price_id` --shares_data_with--> `size_options — D1 table: per-size price, stock, SKU, stripe_price_id`  [INFERRED]
  CONTEXT.md → worker/db/migrations/0000_neat_maddog.sql
- `Review — verified-purchase rating (1-5 stars); requires delivered Order match + Merchant approval` --shares_data_with--> `reviews — D1 table: verified-purchase customer reviews with approval gate`  [INFERRED]
  CONTEXT.md → worker/db/migrations/0000_neat_maddog.sql

## Hyperedges (group relationships)
- **Product → Variant → SizeOption — nested catalog hierarchy with cascading FK deletes** — table_products, table_variants, table_size_options [EXTRACTED 1.00]
- **Order + OrderItems + StripeEvents — transactional purchase record with idempotency dedup** — table_orders, table_order_items, table_stripe_events [EXTRACTED 1.00]
- **$0 Stack — Cloudflare Pages+Workers+D1+KV+R2+Access form a zero-hosting-cost full-stack platform** — concept_zero_cost_hosting, adr_0001_cloudflare_full_stack, adr_0002_d1_sql_over_nosql [EXTRACTED 0.95]
- **createOrder shared by COD and Stripe flows — coupon evaluation, stock decrement, order row insert** — create_order_fn, api_orders_cod, api_stripe_checkout_session, evaluate_coupon_fn, size_options_table [EXTRACTED 1.00]
- **Three-layer admin auth: CF Access edge + Next.js middleware + Worker JWT re-verify share access-core** — cf_access, src_middleware, worker_lib_access, worker_lib_access_core, three_layer_admin_auth [EXTRACTED 1.00]
- **Zero-cost hosting achieved via Cloudflare free tiers: Pages + Workers + D1 + KV + R2 + Turnstile** — arch_cost_normal, zero_cost_hosting_rationale, arch_cost_scale, dynamic_first_rule [INFERRED 0.85]
- **Stripe Webhook Processing Pipeline (Worker + D1 + idempotency)** — cf_workers, d1_database, stripe_events_idempotency [EXTRACTED 0.95]
- **Post-Order Notification Pipeline (Resend + Web Push + Analytics Engine)** — resend_email, web_push_merchant, cf_analytics_engine [EXTRACTED 0.95]
- **Shared Zod Schema Layer (base + order + product + config + admin serving both client and Worker)** — schemas_base_ts, schemas_order_ts, schemas_admin_ts [EXTRACTED 0.95]

## Communities (75 total, 4 thin omitted)

### Community 0 - "Admin UI & Forms"
Cohesion: 0.05
Nodes (31): FormField(), handleDelete(), handleStatusUpdate(), handleTrackingUpdate(), apiDelete(), apiPatch(), apiPut(), apiUpload() (+23 more)

### Community 1 - "Worker Backend & Routes"
Cohesion: 0.06
Nodes (23): createDb(), activeOrdersFilter(), periodFilter(), sinceDate(), etagFor(), parseBody(), dispatchRestockAlerts(), assertItemsAvailable() (+15 more)

### Community 2 - "Store Frontend & Cart"
Cohesion: 0.05
Nodes (23): CartItem(), FreeShippingBar(), useCartItemCount(), useCartSubtotalCents(), useStoreConfig(), createOrder(), evaluateCoupon(), generateOrderNumber() (+15 more)

### Community 3 - "Architecture Docs & CF Platform"
Cohesion: 0.06
Nodes (45): Cloudflare Analytics Engine (Custom Event Tracking), Cloudflare KV (Key-Value Cache), Cloudflare Pages (Static Next.js Hosting), Cloudflare R2 (Object Storage), Cloudflare Turnstile (bot protection), Cloudflare WAF (Web Application Firewall), Cloudflare Workers (Serverless Functions), Cloudflare Ecosystem Architecture Document (+37 more)

### Community 4 - "Feature Docs & API Design"
Cohesion: 0.08
Nodes (33): Admin Guide — Customization, Admin Guide — Orders, Admin Guide — Products, POST /api/coupons/validate endpoint, GET /api/orders/by-session/:sessionId endpoint, POST /api/orders/:orderNumber/cancel endpoint, POST /api/orders/cod endpoint, GET /api/orders/track/:orderNumber endpoint (+25 more)

### Community 5 - "Checkout & Order Tracking"
Cohesion: 0.09
Nodes (12): handleCancel(), handleStripeCheckout(), onSubmit(), TurnstileWidget(), requiredMsg(), apiPost(), onSubmit(), onSubmit() (+4 more)

### Community 6 - "API Endpoints & Config"
Cohesion: 0.1
Nodes (28): GET /api/public-config endpoint (serves Turnstile + VAPID public keys), POST /api/stripe/checkout-session endpoint, POST /api/stripe/webhook endpoint, Caching Strategy, Architecture Overview, BroadcastChannel cross-tab data invalidation (shopflare:data-updated), Cloudflare Access (Zero Trust), ETag + no-cache instead of KV for dynamic API caching (+20 more)

### Community 7 - "Analytics Dashboard"
Cohesion: 0.1
Nodes (7): FunnelTab(), ProductsTab(), usePushSubscription(), ApiError, apiGet(), EnablePushButton(), StatCard()

### Community 9 - "Email Service"
Cohesion: 0.19
Nodes (14): buildBankBlock(), buildOrderEmailHtml(), escHtml(), getStoreConfigValues(), sendEmail(), sendOrderEmails(), sendRestockEmail(), tableRow() (+6 more)

### Community 10 - "Domain Concepts"
Cohesion: 0.13
Nodes (15): CONTEXT.md — Domain glossary for ShopFlare, Admin Dashboard — CF Access-protected /admin/* section for Merchant to manage all store data, Customer — end buyer; no account required; identified by email OR phone + Order ID, Merchant — business owner who configures the Store and manages Products/Orders via Admin Dashboard, Order Status — lifecycle: pending→confirmed→processing→shipped→delivered→cancelled, Payment Method — stripe_checkout | cod | whatsapp | in_person_cash, Point of Sale (POS) — in-person cash register in Admin Dashboard for in_person_cash orders, Product — sellable catalog item with variants; typically 1-5 per store (+7 more)

### Community 11 - "Coverage UI Scripts"
Cohesion: 0.27
Nodes (11): addSortIndicators(), enableUI(), getNthColumn(), getTable(), getTableBody(), getTableHeader(), loadColumns(), loadData() (+3 more)

### Community 12 - "DB Migrations & Tax"
Cohesion: 0.15
Nodes (13): ADR 0002 — D1 (SQL) Over NoSQL for Orders and Products, ADR 0006 — Stripe Checkout Over Raw Card Capture, orders.tax_cents — tax amount column added to orders table, Oversell Protection — stock decrement at checkout creation + restore on cancel/expire guards concurrent purchases, PCI SAQ A compliance — Stripe Checkout delegates card data entirely to Stripe, no raw card ever touches the store, Coupon — discount code synced bidirectionally with Stripe Promotion Codes; abuse-protected, Order — confirmed purchase intent; has Order Number, status lifecycle, payment method, Migration 0003 — Add tax_cents column to orders (+5 more)

### Community 13 - "CF Access Auth"
Cohesion: 0.33
Nodes (8): base64UrlToBytes(), base64UrlToJson(), fetchJwks(), verifyAccessJwt(), getCachedJwks(), requireAccess(), getJwks(), proxy()

### Community 14 - "Policy & Notification UI"
Cohesion: 0.21
Nodes (3): NotifyRequestRow(), Badge(), formatDate()

### Community 15 - "Coverage Prettify"
Cohesion: 0.35
Nodes (8): a(), B(), D(), g(), i(), k(), Q(), y()

### Community 17 - "Product Cards & SEO"
Cohesion: 0.28
Nodes (3): ProductCard(), ProductJsonLd(), getPriceRange()

### Community 18 - "Notify Me Feature"
Cohesion: 0.33
Nodes (9): Notify Me — out-of-stock restock alert request by Customer, seed.sql — Demo seed data for ShopFlare D1, notify_me — D1 table: out-of-stock restock notification requests, pages — D1 table: merchant-editable policy/content pages, product_images — D1 table: R2-backed images per variant, products — D1 table: catalog products with stripe_product_id, reviews — D1 table: verified-purchase customer reviews with approval gate, size_options — D1 table: per-size price, stock, SKU, stripe_price_id (+1 more)

### Community 19 - "Project Docs & Agents"
Cohesion: 0.29
Nodes (8): ADR 0003 — Dynamic Config via D1 — Minimize Redeployments, AGENTS.md — Parallel agent build orchestration plan, CLAUDE.md — Claude instructions, DRY rules, security rules, stack, DRY Rules — enforced 7-layer no-duplication conventions (colors, strings, types, schemas, constants, network, styles), Dynamic-First Rule — merchant-editable values live in D1, no redeploy needed, White-Label — all visible identity (name, logo, colors, policies) from Store Config; repo is the engine, merchant is the brand, Shipping Config — flat rate + free threshold stored in D1 store_config; changeable without redeploy, store_config — D1 key-value table: all merchant-editable config without redeploy

### Community 20 - "DB Migration Chain"
Cohesion: 0.32
Nodes (8): Migration 0000 — Initial D1 schema: all core tables, Migration 0001 — Full schema rebuild with pages, revised coupons/orders/products/reviews/push_subscriptions/store_config/stripe_events, Migration 0002 — Analytics indexes + analytics_daily + carts tables, Plan Phase 0 — Project Scaffold, Plan Phase 7 — Advanced Product and Customer Analytics, analytics_daily — D1 table: $0 daily metric rollup counters for funnel analytics, carts — D1 table: session-keyed cart snapshots for abandonment recovery, order_items — D1 table: line items linked to order with snapshot

### Community 21 - "Image Carousel"
Cohesion: 0.38
Nodes (3): Carousel(), CarouselNext(), useCarousel()

### Community 24 - "Caching & Fingerprinting"
Cohesion: 0.33
Nodes (6): Cloudflare Access Admin Auth — edge JWT gate on /admin/* + Worker-side RS256 re-verification; fail-closed in production, Content-Addressed R2 Keys — nanoid suffix on every upload key enables immutable CDN caching without stale assets, ETag/fingerprint cache freshness — bumpDataVersion() + ETag on every public GET + no-cache Cache-Control; cheap 304 on unchanged data, No-Flash Theme Boot — inline blocking script reads localStorage ThemeSnapshot and sets CSS vars before React hydrates, Plan Phase 6 — Admin Auth Hardening, Cache Freshness, Sticky Save Bar, Plan Phase 8 — Dynamic Theme and Design Settings

### Community 25 - "Coverage Block Navigation"
Cohesion: 0.7
Nodes (4): goToNext(), goToPrevious(), makeCurrent(), toggleClass()

### Community 27 - "ADR Stack Decisions"
Cohesion: 0.4
Nodes (5): ADR 0001 — Full Cloudflare Stack Over Firebase + GitHub Pages, D1 Daily Rollup Analytics — $0 funnel counters via analytics_daily upserts instead of Analytics Engine paid tier, Server-Authoritative Pricing — client sends only sizeOptionId+quantity; Worker computes all amounts from D1, $0 Hosting — Cloudflare free tier + Stripe per-transaction; no monthly fees, README.md — Project overview, stack, architecture, quick start

### Community 32 - "PWA Push Notifications"
Cohesion: 0.67
Nodes (3): ADR 0004 — PWA Web Push for Merchant Notifications Over Telegram/WhatsApp, PWA Web Push — merchant alert delivery via VAPID/FCM/APNs at $0, avoids Telegram VPN friction and WhatsApp Business API cost, push_subscriptions — D1 table: VAPID Web Push subscriptions

## Knowledge Gaps
- **56 isolated node(s):** `Migration 0003 — Add tax_cents column to orders`, `AGENTS.md — Parallel agent build orchestration plan`, `ADR 0001 — Full Cloudflare Stack Over Firebase + GitHub Pages`, `ADR 0002 — D1 (SQL) Over NoSQL for Orders and Products`, `ADR 0005 — Single Email With BCC to Merchant` (+51 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `worker/lib createOrder (Shared Backend Helper)` connect `Architecture Docs & CF Platform` to `Store Frontend & Cart`?**
  _High betweenness centrality (0.176) - this node is a cross-community bridge._
- **Why does `cn()` connect `Shared UI Components` to `Admin UI & Forms`, `Store Frontend & Cart`, `Checkout & Order Tracking`, `Analytics Dashboard`, `Policy & Notification UI`, `API Resource Hooks`, `Product Cards & SEO`, `Image Carousel`, `Dropdown Menu UI`, `Accordion UI`, `Admin Dashboard Stats`, `Radio Group UI`, `Avatar UI`?**
  _High betweenness centrality (0.164) - this node is a cross-community bridge._
- **What connects `Migration 0003 — Add tax_cents column to orders`, `AGENTS.md — Parallel agent build orchestration plan`, `ADR 0001 — Full Cloudflare Stack Over Firebase + GitHub Pages` to the rest of the system?**
  _56 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Admin UI & Forms` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Worker Backend & Routes` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Store Frontend & Cart` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Architecture Docs & CF Platform` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._