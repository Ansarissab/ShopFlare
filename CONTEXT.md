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

Merchant-controlled settings stored in D1: store name, tagline, logo URL, brand colors, contact email, WhatsApp number, social links, currency, country, shipping rates, products-per-page (pagination size), policy content, and Locale settings (enabled Locales + default Locale). Changes take effect without redeploy.

## Product Search

Fuzzy search powered by Fuse.js (threshold 0.35) across product name, description, and variant labels. Reached from a search control in the storefront header (and the `/` keyboard shortcut), which opens a search Overlay that searches and filters the full catalog from any page; results are always Products and link directly to a Product. The Overlay also carries the category (and in-stock) filters, so searching and filtering happen in one place. It searches Products only — never app commands or navigation actions. The catalog is fetched once and cached for this purpose. Active query is kept in the `?q=` URL param for shareability. The in-grid filter on catalog/category pages continues to narrow the already-loaded list.

## Locale

A language the storefront chrome can render in. English is the source Locale; French and Urdu are the first additional Locales. Urdu is right-to-left and uses a bundled font. A Locale translates only UI chrome (static interface strings), not Merchant-authored content (Product text, policies, FAQ) — that is a separate later capability. Which Locales are available and which is the default are Merchant-controlled in Store Config.

## Locale Switcher

A storefront control (in the header) letting the Customer choose among the Locales the Merchant has enabled. Shown only when more than one Locale is enabled. The choice navigates to the Locale's URL prefix and is remembered via a cookie across pages and visits. First-time visitors start on the default Locale (no automatic language detection).

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

## Landing Template

The visual design a Landing Page is rendered with. Merchants can have multiple Landing Pages, each assigned a Template (e.g. Classic plus premium layouts inspired by Wise/Stripe/YC but built from our own theme tokens). Templates are the single switch point `LANDING_TEMPLATE_REGISTRY` (a `Record<LandingTemplate, Component>`) and all compose from the shared kit in `templates/shared/` — `TemplateSection`, `FeaturedGrid`, and `templateKit` (type-scale + button tokens derived from the CSS-variable theme). Adding a design = one component + one registry entry. Distinct from a Style Preset (which recolors/restyles) — a Template changes the layout itself.

## Style Preset

A named, one-click "look" (e.g. Minimal, Bold, Elegant, Playful) bundling brand colors, font, corner radius, density, and hero style. Applied via the existing CSS-variable theme engine. Distinct from a Landing Template, which swaps the page layout itself (see above).

## Rich Text

Merchant-authored formatted content created with the shared Trix editor and stored as sanitized HTML. Used for Blog Posts, policy pages, Landing Page section bodies, and Product descriptions. Inline images are uploaded to R2 (not embedded as base64) and pass through the standard image compression path.

## Blog

An optional collection of Merchant-authored articles published for SEO. Each Blog Post has a title, slug, Rich Text body, cover image (R2), excerpt, tags, and a draft/published state. Server-rendered with Article structured data, listed at `/blog`, and included in the sitemap and RSS feed. Gated by a Feature Flag.

## FAQ

A set of question/answer pairs the Merchant authors. There are two scopes: a store-wide FAQ (shown on a dedicated `/faq` page, linked from the header and included in the sitemap) and a per-Product FAQ (shown on that Product's page). Each is a structured, reorderable list of items (question + Rich Text answer), rendered as a modern accordion and emitted as FAQ structured data. The store-wide FAQ is gated by a Feature Flag; a Product FAQ shows when the Product has items.

## LLM Discovery

The set of optional, Merchant-toggleable features that make the Store legible to AI crawlers and answer engines: an auto-generated `llms.txt`, Markdown (`.md`) versions of public pages, FAQ structured data, and an AI-bot policy in robots.txt (allowing search bots, optionally blocking training bots).

## Marketing Tag

A third-party measurement or advertising integration (Google Analytics 4, Google Ads, Meta Pixel) the Merchant enables by entering its ID in Store Config. Tags load only after the Customer grants Cookie Consent, never before — so they never run during an unconsented page load. White-label: no tag fires unless the Merchant configured its ID.

## Site Verification

A token a Merchant pastes into Store Config to prove Store ownership to a search engine (Google Search Console, Bing Webmaster Tools). Rendered as a verification meta tag. Merchants may also add extra `<meta>`/`<link>` tags through a sanitized custom-tags field (never raw scripts).

## Cookie Consent

The Customer's recorded choice to allow or refuse non-essential cookies. Gates all Marketing Tags. Required wherever EU visitors are served (e.g. the French Locale). Until consent is granted, no Marketing Tag loads.

## Announcement Bar

A thin notice bar at the very top of the storefront (above the header) for delivery, sales, or general notices. Merchant-controlled in Store Config and gated by a Feature Flag. The Merchant picks a type — a single message, a scheduled message (auto shows/hides between a start and end time), or several rotating messages. Each message has text, an optional link, and an optional color. The Customer can dismiss it; dismissal is remembered per message version, so a new announcement reappears. Its text is Merchant-authored content (not yet Locale-translated).

## Health Check

A machine endpoint (`/healthz`) that probes D1, KV, and R2 and returns an overall status (200 healthy / 503 degraded). Consumed by the public Status Page and by an external uptime monitor.

## Status Page

A public page reporting the Store's current operational health, backed by the Health Check. Paired with an external monitor for uptime history and alerting.

## Keyboard Shortcuts

Universal, always-on key bindings active on both the storefront and the Admin Dashboard. Not Merchant-configurable; not gated by a Feature Flag; not stored in D1. Storefront: `/` opens the search Overlay, `c` opens the cart, `?` opens the cheat-sheet overlay, `Esc` closes. Admin: `g o/p/c/a` navigate to orders/products/coupons/analytics, `c` creates in the current list context, `/` focuses search, `j`/`k` navigate table rows, `Enter` opens the selected row, `?` opens the cheat-sheet, `Esc` closes. Typing in inputs/textareas/contenteditable is always unaffected; Esc always works even in inputs.

## Cheat-sheet Overlay

A modal overlay (`?` shortcut on any page) listing all active keyboard shortcuts for the current surface (storefront or admin). Localized (strings via i18n dictionaries), RTL-aware, and respects `prefers-reduced-motion`.
