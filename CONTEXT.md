# Domain Context

## Store

A white-label ecommerce web application deployed by a Merchant to sell Products to Customers. One Store = one deployed instance.

## Merchant

The business owner who forks the repo, configures the Store, and manages Products and Orders via the Admin Dashboard. Not the end customer.

## Customer

A person browsing the Store and placing Orders. No account required. Identified by email OR phone number + Order ID.

## Product

A sellable item in the Store catalog. Has a name, description, images, and one or more Variants. A Store typically sells 1–5 Products.

## Variant

A color or style configuration of a Product (e.g. "Red", "Ocean Blue"). Each Variant has its own images and one or more Size Options. Maximum 5 Variants per Product.

## Size Option

A specific size within a Variant (e.g. "XL", "EU42"). Each Size Option has its own price (in cents), stock count, optional SKU, and a Stripe Price ID.

## SKU

Stock Keeping Unit. An optional identifier for a Size Option. Set by the Merchant. Used in WhatsApp messages and order receipts.

## Order

A confirmed intent to purchase one or more Size Options. Created when a Customer completes checkout via any Payment Method. Has a unique Order Number, status, and lifecycle.

## Order Number

A short human-readable identifier for an Order (e.g. ORD-V1ST8X). Auto-generated using nanoid. Used in tracking URLs and customer communications.

## Order Status

The lifecycle stage of an Order:

- `pending` — created, awaiting payment or merchant confirmation
- `confirmed` — payment received (Stripe) or merchant confirmed (COD)
- `processing` — being prepared
- `shipped` — dispatched, tracking number available
- `delivered` — received by Customer
- `cancelled` — cancelled by Customer (only from pending/confirmed) or Merchant

## Payment Method

The mechanism used to pay for an Order. One of:

- `stripe_checkout` — Stripe-hosted checkout page (cards, digital wallets)
- `cod` — Cash on Delivery, collected in person
- `bank_transfer` — Manual bank transfer; order email includes a bank-details block
- `whatsapp` — Order initiated via WhatsApp, payment arranged manually
- `in_person_cash` — POS sale, cash collected at point of sale

## Stripe Checkout

A Stripe-hosted payment page. The Store never handles raw card data. PCI compliance delegated entirely to Stripe.

## COD (Cash on Delivery)

An Order where payment is collected when goods are delivered. Requires Customer name, phone, and shipping address. Merchant confirms via Admin Dashboard.

## WhatsApp Order

An Order initiated by a Customer sending a pre-filled WhatsApp message to the Merchant. The Store generates the message URL from selected Product + Variant + Size.

## Point of Sale (POS)

A software cash register in the Admin Dashboard. Merchant selects Product/Variant/Size, enters Customer phone, creates an Order (payment_method: in_person_cash), and optionally sends order summary via WhatsApp.

## Shipping Config

Merchant-configured rules: flat rate (in cents), free shipping threshold (in cents), and operating currency. Stored in D1 store_config. Changeable without redeploy.

## Coupon

A discount code that reduces Order total. Synced bidirectionally with Stripe Promotion Codes. Enforced server-side by Stripe. Abuse-protected via rate limiting, per-customer limits, and usage caps.

## Tracking Number

An alphanumeric code entered by the Merchant when an Order ships. Displayed on the Order Tracking Page. Associated with a carrier name.

## Order Tracking Page

A public client-rendered page at /track/[orderId] showing Order status timeline, items, and Tracking Number.

## Admin Dashboard

A password-protected section of the Store at /admin/* (app-level admin password → signed session token). Used by the Merchant to manage Products, Orders, Coupons, Shipping, Store Config, and analytics.

## Store Config

Merchant-controlled settings stored in D1: store name, tagline, logo URL, brand colors, contact email, WhatsApp number, social links, currency, country, shipping rates, products-per-page (pagination size), and policy content. Changes take effect without redeploy.

## Product Search

Client-side fuzzy search powered by Fuse.js (threshold 0.35). Searches across product name, description, and variant labels. No API call — all matching runs against the already-loaded product list in the browser. Active query is kept in the `?q=` URL param for shareability. Works in combination with category filter on the home page and stand-alone on category pages.

## White-Label

The Store has no branding from the underlying software. All visible identity (name, logo, colors, policies) comes from Store Config. The open-source repo is the engine; the Merchant is the brand.

## Review

A verified Customer rating (1–5 stars) and optional text/photo submitted after an Order is delivered. Only verified purchasers (matched by email/phone to a delivered Order) can submit. Requires Merchant approval before display. Reviews are gated by a Feature Flag: they can be switched off site-wide or for an individual Product. When off, the storefront hides reviews and the submit endpoint refuses new ones; existing reviews are preserved.

## Notify Me

A request by a Customer to be emailed/WhatsApped when an out-of-stock Size Option is restocked.

## Setup Wizard

An interactive CLI tool (`pnpm setup`) that guides the Merchant through initial deployment: Cloudflare login, R2 bucket creation, DB migrations + seed, worker secrets (Stripe, Resend, Turnstile, admin password), API worker deploy (auto-provisions D1 + KV on first deploy via wrangler ≥ 4.45.0), Stripe webhook auto-create, frontend worker deploy, and `.env.local` generation. Ends with a `/api/ping` smoke check.

## Feature Flag

A Merchant-controlled on/off switch for an optional capability (e.g. WhatsApp, Reviews, Landing Page, Blog, LLM Discovery). Stored in Store Config and toggled from the Admin Dashboard. Off-state is enforced server-side, not merely hidden in the UI. A flag may be site-wide; some (e.g. Reviews) also have a per-Product flag, where the site-wide off-state wins.

## WhatsApp Widget

A persistent floating WhatsApp button shown on every storefront page (distinct from the per-Product WhatsApp Order button). Opens a generic wa.me chat with the Merchant. Gated by a Feature Flag and the presence of a WhatsApp number.

## Landing Page

An optional storytelling home page that replaces the Product grid at `/` when enabled (the catalog then lives at `/shop`). Composed of a fixed, ordered set of Merchant-editable Sections (hero, story, Featured Products, reviews strip, call-to-action). Section text and images are edited from the Admin Dashboard without redeploy. Gated by a Feature Flag.

## Featured Product

A Product the Merchant selects to highlight in the Landing Page's featured strip. Selection is Merchant-controlled and stored in Store Config / D1.

## Style Preset

A named, one-click "look" (e.g. Minimal, Bold, Elegant, Playful) bundling brand colors, font, corner radius, density, and hero style. Applied via the existing CSS-variable theme engine. Distinct from full alternate layout templates (a v2 concept).

## Rich Text

Merchant-authored formatted content created with the shared Trix editor and stored as sanitized HTML. Used for Blog Posts, policy pages, Landing Page section bodies, and Product descriptions. Inline images are uploaded to R2 (not embedded as base64) and pass through the standard image compression path.

## Blog

An optional collection of Merchant-authored articles published for SEO. Each Blog Post has a title, slug, Rich Text body, cover image (R2), excerpt, tags, and a draft/published state. Server-rendered with Article structured data, listed at `/blog`, and included in the sitemap and RSS feed. Gated by a Feature Flag.

## LLM Discovery

The set of optional, Merchant-toggleable features that make the Store legible to AI crawlers and answer engines: an auto-generated `llms.txt`, Markdown (`.md`) versions of public pages, FAQ structured data, and an AI-bot policy in robots.txt (allowing search bots, optionally blocking training bots).

## Health Check

A machine endpoint (`/healthz`) that probes D1, KV, and R2 and returns an overall status (200 healthy / 503 degraded). Consumed by the public Status Page and by an external uptime monitor.

## Status Page

A public page reporting the Store's current operational health, backed by the Health Check. Paired with an external monitor for uptime history and alerting.
