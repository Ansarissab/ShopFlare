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
A password-protected (Cloudflare Access) section of the Store at /admin/*. Used by the Merchant to manage Products, Orders, Coupons, Shipping, Store Config, and analytics.

## Store Config
Merchant-controlled settings stored in D1: store name, tagline, logo URL, brand colors, contact email, WhatsApp number, social links, currency, country, shipping rates, and policy content. Changes take effect without redeploy.

## White-Label
The Store has no branding from the underlying software. All visible identity (name, logo, colors, policies) comes from Store Config. The open-source repo is the engine; the Merchant is the brand.

## Review
A verified Customer rating (1–5 stars) and optional text/photo submitted after an Order is delivered. Only verified purchasers (matched by email/phone to a delivered Order) can submit. Requires Merchant approval before display.

## Notify Me
A request by a Customer to be emailed/WhatsApped when an out-of-stock Size Option is restocked.

## Setup Wizard
An interactive CLI tool (npx create-store) that guides the Merchant through initial deployment: API keys, Cloudflare D1 creation, Worker deployment, CF Access configuration, and DB migrations.
