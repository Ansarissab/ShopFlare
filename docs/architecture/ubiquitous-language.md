# Ubiquitous Language

Canonical terms for ShopFlare. Source of truth: [CONTEXT.md](../../CONTEXT.md) plus
`src/lib/constants/index.ts`, `src/lib/schemas/`, and `worker/db/schema.ts`. When
code and this file disagree, fix one of them — drift is a bug.

## Actors

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Merchant** | Business owner who forks the repo, configures the Store, manages catalog and Orders via the Admin Dashboard | Seller, vendor, store owner, admin user |
| **Customer** | Person browsing the Store and placing Orders; no account, identified by email OR phone + Order Number | Buyer, client, shopper, user, account |

## Storefront & catalog

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Store** | One deployed white-label instance selling Products to Customers (one Store = one deployment) | Site, shop, instance, app |
| **White-Label** | The Store carries no branding from the underlying software; all identity comes from Store Config | Unbranded, generic |
| **Product** | A sellable catalog item with name, description, images, and one or more Variants | Item, listing, SKU |
| **Variant** | A color/style configuration of a Product, with its own images and Size Options (max 5 per Product) | Option, version, style, type |
| **Size Option** | A specific size within a Variant; the priced, stocked, sellable unit (price_cents, stock, optional SKU, Stripe Price ID) | Size, SKU, variant |
| **SKU** | Optional Merchant-set stock identifier on a Size Option; used in WhatsApp messages and receipts | Variant, product code |
| **Policy Page** | Merchant-editable content page (`shipping`, `returns`, `privacy`, `terms`) stored in the `pages` table | Static page, CMS page, content |

## Cart & pricing

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Cart** | Session-keyed selection of Size Options held client-side before checkout; snapshotted to the `carts` table for abandonment recovery (max 50 items) | Basket, bag |
| **Server-Authoritative Pricing** | The client sends only `sizeOptionId` + quantity; the Worker computes every amount from D1. Client never sends prices | Client pricing, trusted totals |
| **Tax** | Order tax (`tax_cents`), computed on a configurable **Tax Basis** — `subtotal` or `subtotal_and_shipping` | VAT, GST (use as locale labels only) |
| **Coupon** | Discount code reducing Order total, synced with Stripe Promotion Codes, enforced server-side; redemptions tracked in `coupon_uses` for abuse prevention | Promo, voucher, discount code |

## Order lifecycle

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Order** | A confirmed intent to purchase one or more Size Options, created at checkout | Purchase, transaction, sale, cart |
| **Order Item** | A single line item on an Order, carrying a **Snapshot** of the product at purchase time | Line item, order line |
| **Snapshot** | Frozen JSON of product name/image stored on an Order Item so it survives later product edits | Copy, cache |
| **Order Number** | Short human-readable Order identifier (e.g. `ORD-V1ST8X`), nanoid-generated | Order ID, ref, receipt number |
| **Order Status** | Lifecycle stage: `pending` → `confirmed` → `processing` → `shipped` → `delivered`, or `cancelled` | State, stage |
| **Tracking Number** | Carrier code the Merchant enters when an Order ships | Tracking ID, shipment code |
| **Order Tracking Page** | Public page at `/track/[orderId]` showing status timeline, items, Tracking Number | Status page, tracker |

## Inventory

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Stock** | Per-Size-Option count. `> 5` in stock, `1–5` Low Stock, `0` Out of Stock, `-1` Unlimited (never decremented) | Inventory, quantity, qty |
| **Oversell Protection** | Stock is decremented in `createOrder` at checkout creation and restored on cancel/expire, guarding concurrent purchases | Stock lock, reservation |
| **Restock** | Merchant raising a Size Option's stock above 0, which fires queued Restock Alerts | Replenish |

## Payment

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Payment Method** | How an Order is paid: `stripe_checkout`, `cod`, `bank_transfer`, `whatsapp`, `in_person_cash` | Payment type, channel |
| **Stripe Checkout** | Stripe-hosted payment page; the Store never touches raw card data (PCI SAQ A) | Stripe, card payment |
| **COD** | Cash on Delivery; payment collected at delivery, Merchant-confirmed | Cash, pay later |
| **Bank Transfer** | Order paid by manual transfer; the order email includes a bank-details block built by the Worker | Wire, direct deposit |
| **WhatsApp Order** | Order initiated via a pre-filled WhatsApp message; payment arranged manually | WhatsApp checkout, chat order |
| **Point of Sale (POS)** | In-dashboard cash register; Merchant creates an Order as `in_person_cash` | Register, counter sale |
| **Stripe Event** | A processed Stripe webhook, deduplicated by `event_id` in `stripe_events` for idempotency | Webhook, callback |

## Merchant config

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Admin Dashboard** | Password-protected `/admin/*` area (app-level login → session token) for managing the Store | Admin panel, backend, CMS |
| **Store Config** | Merchant settings in the `store_config` key-value table (name, logo, colors, currency, shipping, tax, policies); changes apply without redeploy | Settings, store settings |
| **Shipping Config** | Flat rate, free-shipping threshold, and operating currency (a slice of Store Config) | Shipping rules, delivery config |
| **Dynamic-First Rule** | Any value that can live in D1 and be edited from the Admin Dashboard MUST — minimize redeploys | Config-driven |
| **Setup Wizard** | `npx create-store` CLI that walks the Merchant through first deployment | Installer, onboarding |

## Customer engagement

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Review** | Verified 1–5 star rating (+ optional text/photo) from a delivered-Order Customer, needs Merchant approval | Rating, comment, feedback |
| **Notify Me** | Customer request to be alerted when an Out-of-Stock Size Option is restocked | Waitlist, back-in-stock alert |
| **Restock Alert** | The email/WhatsApp the Worker dispatches to Notify Me subscribers when a Size Option restocks | Notification, back-in-stock email |
| **Abandonment** | A Cart with no resulting Order after `ABANDONMENT_HOURS` (24h); surfaced in analytics for recovery | Drop-off, lost cart |

## Analytics

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Funnel** | The ordered conversion steps `product_view` → `add_to_cart` → `checkout_start` → `purchase` | Conversion path |
| **RFM** | Customer segmentation by Recency / Frequency / Monetary value, thresholded in constants | Segments, cohorts |
| **Daily Rollup** | $0 funnel counters upserted into `analytics_daily` instead of paid Analytics Engine queries | Aggregation, metrics table |

## PWA / native shell

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Push Subscription** | A browser endpoint persisted to receive Web Push; `admin` kind (Merchant order alerts) or `order` kind (Customer, tied to an Order Number) | Notification, subscriber |
| **VAPID** | The keypair authenticating Web Push; the public key is served via `/api/public-config` | Push key |
| **Offline Queue** | IndexedDB store of mutations made while offline, drained when connectivity returns | Outbox, sync queue |
| **Standalone Mode** | The Store running as an installed PWA, showing the native bottom Tab bar | Installed mode, app mode |
| **TWA** | Trusted Web Activity — the Store wrapped as an Android Play Store app via Digital Asset Links | Android wrapper, native app |

## Relationships

- A **Store** is owned by exactly one **Merchant** and shows many **Products**.
- A **Product** has one or more **Variants**; a **Variant** has one or more **Size Options**.
- An **Order** has many **Order Items**; each **Order Item** references one **Size Option** and carries a **Snapshot**.
- An **Order** has exactly one **Payment Method** and one **Order Status**.
- A **Customer** is not a stored account; they are matched to an **Order** by email/phone + **Order Number**.
- A **Cart** is session-keyed and pre-Order; it becomes an **Order** only at checkout. Server-Authoritative Pricing recomputes all totals at that point.
- A **Review** requires a `delivered` **Order** matched to the **Customer**, plus **Merchant** approval.
- A **Notify Me** on an Out-of-Stock **Size Option** produces a **Restock Alert** when that Size Option restocks.
- A **Push Subscription** of kind `order` belongs to exactly one **Order** (via **Order Number**); kind `admin` belongs to the **Merchant**.

## Example dialogue

> **Dev:** "When a **Customer** does a **WhatsApp Order**, do we write an **Order** row right away?"

> **Domain expert:** "No. The **Store** just builds the pre-filled WhatsApp URL from the chosen **Product**, **Variant**, and **Size Option**. No **Order** exists until the **Merchant** records it — usually through **POS** as `in_person_cash`, or `whatsapp` if payment was arranged in chat."

> **Dev:** "And the totals — the client sends the **Cart** subtotal?"

> **Domain expert:** "Never. That's **Server-Authoritative Pricing** — the client sends only `sizeOptionId` and quantity, the Worker recomputes subtotal, **Tax**, shipping, and any **Coupon** from D1. Each resulting **Order Item** also gets a **Snapshot** so the receipt survives later product edits."

> **Dev:** "If two Customers check out the last unit at once?"

> **Domain expert:** "**Oversell Protection** — `createOrder` decrements **Stock** conditionally, and restores it if the Order cancels or the Stripe session expires. Once stock hits 0 the size shows Out of Stock with a **Notify Me**, and a **Restock Alert** goes out when the **Merchant** restocks."

> **Dev:** "Got it. And only a Customer with an `order`-kind **Push Subscription** gets order push?"

> **Domain expert:** "Right. `admin`-kind subscriptions are the **Merchant's** new-order alerts — different audience. Never collapse the two into one 'notification' bucket."

## Flagged ambiguities

- **"user" / "account"** — the codebase has no Customer accounts, and no admin accounts
  either. A **Customer** is identified per-Order by email/phone + **Order Number**. The
  **Merchant** authenticates with a single shared admin password (which mints a session
  token) — there is no per-user record and no sign-up.

- **"SKU" vs "Size Option" vs "Variant"** — three distinct things. The **Size Option**
  is the priced, stocked, sellable unit. **SKU** is just an optional label on it. A
  **Variant** is the color/style above it. Don't use "SKU" to mean the sellable unit.

- **"Order ID" vs "Order Number"** — the tracking route is `/track/[orderId]` but the
  human-facing identifier is the **Order Number** (`ORD-...`). Treat `orderId` as an
  implementation-only route param.

- **`bank_transfer` not in CONTEXT.md** — it is implemented (a `PAYMENT_METHODS` value
  and the email bank-details block) but missing from [CONTEXT.md](../../CONTEXT.md)'s
  Payment Method list. Document it there to close the drift.

- **`push_subscriptions` description is stale** —
  [database-schema.md](database-schema.md) calls the table "Merchant PWA push endpoints",
  but it now also stores `order`-kind Customer subscriptions tied to an Order Number.
  Update that row.

- **Variant cap stated twice** — CONTEXT.md prose says "Maximum 5 Variants"; the constant
  is `MAX_VARIANTS = 5`. Keep prose deferring to the constant so they can't diverge.
