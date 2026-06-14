import { sqliteTable, text, integer, primaryKey, index } from 'drizzle-orm/sqlite-core'
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'
import type { LandingSectionKey } from '@/lib/constants'

// ─── Products ───────────────────────────────────────────────────────────────

export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  reviewsEnabled: integer('reviews_enabled', { mode: 'boolean' }).notNull().default(true),
  stripeProductId: text('stripe_product_id'),
  faqItems: text('faq_items'), // JSON: FaqItem[] (phase 30)
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

export const variants = sqliteTable('variants', {
  id: text('id').primaryKey(),
  productId: text('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  colorHex: text('color_hex'),
  sortOrder: integer('sort_order').notNull().default(0),
})

export const sizeOptions = sqliteTable('size_options', {
  id: text('id').primaryKey(),
  variantId: text('variant_id')
    .notNull()
    .references(() => variants.id, { onDelete: 'cascade' }),
  size: text('size').notNull(),
  sku: text('sku'),
  priceCents: integer('price_cents').notNull(),
  stock: integer('stock').notNull().default(0), // -1 = unlimited
  stripePriceId: text('stripe_price_id'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
})

export const productImages = sqliteTable('product_images', {
  id: text('id').primaryKey(),
  variantId: text('variant_id')
    .notNull()
    .references(() => variants.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  r2Key: text('r2_key').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
})

// ─── Categories ────────────────────────────────────────────────────────────────

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description').notNull().default(''),
  parentId: text('parent_id').references((): AnySQLiteColumn => categories.id, {
    onDelete: 'set null',
  }),
  imageUrl: text('image_url'),
  r2Key: text('r2_key'),
  sortOrder: integer('sort_order').notNull().default(0),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

// ─── Product ↔ Category (junction) ────────────────────────────────────────────

export const productCategories = sqliteTable(
  'product_categories',
  {
    productId: text('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    categoryId: text('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.productId, t.categoryId] }),
  }),
)

// ─── Orders ─────────────────────────────────────────────────────────────────

export const orders = sqliteTable(
  'orders',
  {
    id: text('id').primaryKey(),
    orderNumber: text('order_number').notNull().unique(),
    status: text('status', {
      enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
    })
      .notNull()
      .default('pending'),
    paymentMethod: text('payment_method', {
      enum: ['stripe_checkout', 'cod', 'bank_transfer', 'whatsapp', 'in_person_cash'],
    }).notNull(),
    customerName: text('customer_name').notNull(),
    customerEmail: text('customer_email'),
    customerPhone: text('customer_phone'),
    shippingAddress: text('shipping_address'), // JSON string
    subtotalCents: integer('subtotal_cents').notNull(),
    shippingCents: integer('shipping_cents').notNull().default(0),
    discountCents: integer('discount_cents').notNull().default(0),
    taxCents: integer('tax_cents').notNull().default(0),
    totalCents: integer('total_cents').notNull(),
    couponCode: text('coupon_code'),
    stripeSessionId: text('stripe_session_id'),
    stripePaymentIntentId: text('stripe_payment_intent_id'),
    trackingNumber: text('tracking_number'),
    carrier: text('carrier'),
    notes: text('notes'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => ({
    createdAtIdx: index('orders_created_at_idx').on(t.createdAt),
    statusIdx: index('orders_status_idx').on(t.status),
    stripeSessionIdIdx: index('orders_stripe_session_id_idx').on(t.stripeSessionId),
  }),
)

export const orderItems = sqliteTable(
  'order_items',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    sizeOptionId: text('size_option_id').notNull(),
    productId: text('product_id').notNull(),
    variantId: text('variant_id').notNull(),
    quantity: integer('quantity').notNull().default(1),
    priceCents: integer('price_cents').notNull(),
    snapshot: text('snapshot').notNull(), // JSON: {productName, variantLabel, size, sku, imageUrl}
  },
  (t) => ({
    orderIdIdx: index('order_items_order_id_idx').on(t.orderId),
  }),
)

// ─── Coupons ─────────────────────────────────────────────────────────────────

export const coupons = sqliteTable('coupons', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  type: text('type', { enum: ['percentage', 'fixed'] }).notNull(),
  value: integer('value').notNull(),
  minOrderCents: integer('min_order_cents'),
  maxDiscountCents: integer('max_discount_cents'),
  usageLimit: integer('usage_limit'),
  perCustomerLimit: integer('per_customer_limit').notNull().default(1),
  usedCount: integer('used_count').notNull().default(0),
  expiresAt: text('expires_at'),
  stripeCouponId: text('stripe_coupon_id'),
  stripePromotionCodeId: text('stripe_promotion_code_id'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

export const couponUses = sqliteTable(
  'coupon_uses',
  {
    id: text('id').primaryKey(),
    couponId: text('coupon_id')
      .notNull()
      .references(() => coupons.id),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id),
    customerEmail: text('customer_email'),
    customerPhone: text('customer_phone'),
    customerIp: text('customer_ip'),
    usedAt: text('used_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => ({
    couponIdIdx: index('coupon_uses_coupon_id_idx').on(t.couponId),
    orderIdIdx: index('coupon_uses_order_id_idx').on(t.orderId),
  }),
)

// ─── Reviews ─────────────────────────────────────────────────────────────────

export const reviews = sqliteTable('reviews', {
  id: text('id').primaryKey(),
  orderId: text('order_id')
    .notNull()
    .references(() => orders.id),
  productId: text('product_id')
    .notNull()
    .references(() => products.id),
  customerName: text('customer_name').notNull(),
  rating: integer('rating').notNull(), // 1-5
  body: text('body'),
  photoUrl: text('photo_url'),
  photoR2Key: text('photo_r2_key'),
  approved: integer('approved', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

// ─── Notify Me ───────────────────────────────────────────────────────────────

export const notifyMe = sqliteTable('notify_me', {
  id: text('id').primaryKey(),
  sizeOptionId: text('size_option_id')
    .notNull()
    .references(() => sizeOptions.id),
  email: text('email'),
  phone: text('phone'),
  notified: integer('notified', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

// ─── Landing Page ────────────────────────────────────────────────────────────

export const landingContent = sqliteTable('landing_content', {
  sectionKey: text('section_key').$type<LandingSectionKey>().primaryKey(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  heading: text('heading'),
  subtext: text('subtext'),
  bodyHtml: text('body_html'),
  ctaText: text('cta_text'),
  ctaHref: text('cta_href'),
  imageR2Key: text('image_r2_key'),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

export const featuredProducts = sqliteTable('featured_products', {
  productId: text('product_id')
    .primaryKey()
    .references(() => products.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').notNull().default(0),
})

// ─── Store Config ────────────────────────────────────────────────────────────

export const storeConfig = sqliteTable('store_config', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

// ─── Stripe Events (idempotency) ─────────────────────────────────────────────

export const stripeEvents = sqliteTable('stripe_events', {
  id: text('id').primaryKey(),
  eventId: text('event_id').notNull().unique(),
  type: text('type').notNull(),
  processedAt: text('processed_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

// ─── Policy Pages ────────────────────────────────────────────────────────────

export const pages = sqliteTable('pages', {
  slug: text('slug').primaryKey(), // shipping | returns | privacy | terms
  title: text('title').notNull(),
  content: text('content').notNull().default(''),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

// ─── Analytics daily rollups (funnel layer 2, $0 D1 upsert counters) ─────────

export const analyticsDaily = sqliteTable('analytics_daily', {
  date: text('date').notNull(),
  metric: text('metric').notNull(),
  count: integer('count').notNull().default(0),
})

// ─── Carts (funnel layer 2 — snapshot written on checkout_start only) ─────────

export const carts = sqliteTable('carts', {
  sessionId: text('session_id').primaryKey(),
  items: text('items').notNull(), // JSON: CartItem[]
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  recovered: integer('recovered', { mode: 'boolean' }).notNull().default(false),
})

// ─── Push Subscriptions ──────────────────────────────────────────────────────

export const pushSubscriptions = sqliteTable('push_subscriptions', {
  id: text('id').primaryKey(),
  endpoint: text('endpoint').notNull().unique(),
  auth: text('auth').notNull(),
  p256dh: text('p256dh').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

// ─── Customer Push Subscriptions ─────────────────────────────────────────────

export const customerPushSubscriptions = sqliteTable('customer_push_subscriptions', {
  id: text('id').primaryKey(),
  endpoint: text('endpoint').notNull().unique(),
  auth: text('auth').notNull(),
  p256dh: text('p256dh').notNull(),
  orderNumber: text('order_number'),
  customerEmail: text('customer_email'),
  customerPhone: text('customer_phone'),
  kind: text('kind', { enum: ['order', 'restock'] })
    .notNull()
    .default('order'),
  sizeOptionId: text('size_option_id'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

// ─── Blog Posts ──────────────────────────────────────────────────────────────

export const blogPosts = sqliteTable(
  'blog_posts',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    bodyHtml: text('body_html').notNull().default(''),
    excerpt: text('excerpt').notNull().default(''),
    coverR2Key: text('cover_r2_key'),
    coverAlt: text('cover_alt'),
    tags: text('tags').notNull().default('[]'),
    status: text('status').notNull().default('draft'),
    publishedAt: text('published_at'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => ({
    statusIdx: index('blog_posts_status_idx').on(t.status),
    publishedAtIdx: index('blog_posts_published_at_idx').on(t.publishedAt),
  }),
)

// ─── Type exports ────────────────────────────────────────────────────────────

export type Product = typeof products.$inferSelect
export type NewProduct = typeof products.$inferInsert
export type Variant = typeof variants.$inferSelect
export type SizeOption = typeof sizeOptions.$inferSelect
export type ProductImage = typeof productImages.$inferSelect
export type Order = typeof orders.$inferSelect
export type NewOrder = typeof orders.$inferInsert
export type OrderItem = typeof orderItems.$inferSelect
export type Coupon = typeof coupons.$inferSelect
export type Review = typeof reviews.$inferSelect
export type LandingContent = typeof landingContent.$inferSelect
export type FeaturedProduct = typeof featuredProducts.$inferSelect
export type StoreConfig = typeof storeConfig.$inferSelect
export type Page = typeof pages.$inferSelect
export type AnalyticsDaily = typeof analyticsDaily.$inferSelect
export type Cart = typeof carts.$inferSelect
export type CustomerPushSubscription = typeof customerPushSubscriptions.$inferSelect
export type NewCustomerPushSubscription = typeof customerPushSubscriptions.$inferInsert
export type Category = typeof categories.$inferSelect
export type NewCategory = typeof categories.$inferInsert
export type ProductCategory = typeof productCategories.$inferSelect
export type BlogPost = typeof blogPosts.$inferSelect
export type NewBlogPost = typeof blogPosts.$inferInsert
