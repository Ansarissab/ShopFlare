import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

// ─── Products ───────────────────────────────────────────────────────────────

export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  stripeProductId: text('stripe_product_id'),
  createdAt: text('created_at').notNull().default("(datetime('now'))"),
  updatedAt: text('updated_at').notNull().default("(datetime('now'))"),
})

export const variants = sqliteTable('variants', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  colorHex: text('color_hex'),
  sortOrder: integer('sort_order').notNull().default(0),
})

export const sizeOptions = sqliteTable('size_options', {
  id: text('id').primaryKey(),
  variantId: text('variant_id').notNull().references(() => variants.id, { onDelete: 'cascade' }),
  size: text('size').notNull(),
  sku: text('sku'),
  priceCents: integer('price_cents').notNull(),
  stock: integer('stock').notNull().default(0),  // -1 = unlimited
  stripePriceId: text('stripe_price_id'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
})

export const productImages = sqliteTable('product_images', {
  id: text('id').primaryKey(),
  variantId: text('variant_id').notNull().references(() => variants.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  r2Key: text('r2_key').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
})

// ─── Orders ─────────────────────────────────────────────────────────────────

export const orders = sqliteTable('orders', {
  id: text('id').primaryKey(),
  orderNumber: text('order_number').notNull().unique(),
  status: text('status', {
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']
  }).notNull().default('pending'),
  paymentMethod: text('payment_method', {
    enum: ['stripe_checkout', 'cod', 'whatsapp', 'in_person_cash']
  }).notNull(),
  customerName: text('customer_name').notNull(),
  customerEmail: text('customer_email'),
  customerPhone: text('customer_phone'),
  shippingAddress: text('shipping_address'),  // JSON string
  subtotalCents: integer('subtotal_cents').notNull(),
  shippingCents: integer('shipping_cents').notNull().default(0),
  discountCents: integer('discount_cents').notNull().default(0),
  totalCents: integer('total_cents').notNull(),
  couponCode: text('coupon_code'),
  stripeSessionId: text('stripe_session_id'),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  trackingNumber: text('tracking_number'),
  carrier: text('carrier'),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default("(datetime('now'))"),
  updatedAt: text('updated_at').notNull().default("(datetime('now'))"),
})

export const orderItems = sqliteTable('order_items', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  sizeOptionId: text('size_option_id').notNull(),
  productId: text('product_id').notNull(),
  variantId: text('variant_id').notNull(),
  quantity: integer('quantity').notNull().default(1),
  priceCents: integer('price_cents').notNull(),
  snapshot: text('snapshot').notNull(),  // JSON: {productName, variantLabel, size, sku, imageUrl}
})

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
  createdAt: text('created_at').notNull().default("(datetime('now'))"),
})

export const couponUses = sqliteTable('coupon_uses', {
  id: text('id').primaryKey(),
  couponId: text('coupon_id').notNull().references(() => coupons.id),
  orderId: text('order_id').notNull().references(() => orders.id),
  customerEmail: text('customer_email'),
  customerPhone: text('customer_phone'),
  customerIp: text('customer_ip'),
  usedAt: text('used_at').notNull().default("(datetime('now'))"),
})

// ─── Reviews ─────────────────────────────────────────────────────────────────

export const reviews = sqliteTable('reviews', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull().references(() => orders.id),
  productId: text('product_id').notNull().references(() => products.id),
  customerName: text('customer_name').notNull(),
  rating: integer('rating').notNull(),  // 1-5
  body: text('body'),
  photoUrl: text('photo_url'),
  photoR2Key: text('photo_r2_key'),
  approved: integer('approved', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().default("(datetime('now'))"),
})

// ─── Notify Me ───────────────────────────────────────────────────────────────

export const notifyMe = sqliteTable('notify_me', {
  id: text('id').primaryKey(),
  sizeOptionId: text('size_option_id').notNull().references(() => sizeOptions.id),
  email: text('email'),
  phone: text('phone'),
  notified: integer('notified', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().default("(datetime('now'))"),
})

// ─── Store Config ────────────────────────────────────────────────────────────

export const storeConfig = sqliteTable('store_config', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull().default("(datetime('now'))"),
})

// ─── Stripe Events (idempotency) ─────────────────────────────────────────────

export const stripeEvents = sqliteTable('stripe_events', {
  id: text('id').primaryKey(),
  eventId: text('event_id').notNull().unique(),
  type: text('type').notNull(),
  processedAt: text('processed_at').notNull().default("(datetime('now'))"),
})

// ─── Push Subscriptions ──────────────────────────────────────────────────────

export const pushSubscriptions = sqliteTable('push_subscriptions', {
  id: text('id').primaryKey(),
  endpoint: text('endpoint').notNull().unique(),
  auth: text('auth').notNull(),
  p256dh: text('p256dh').notNull(),
  createdAt: text('created_at').notNull().default("(datetime('now'))"),
})

// ─── Type exports ────────────────────────────────────────────────────────────

export type Product = typeof products.$inferSelect
export type NewProduct = typeof products.$inferInsert
export type Variant = typeof variants.$inferSelect
export type SizeOption = typeof sizeOptions.$inferSelect
export type Order = typeof orders.$inferSelect
export type NewOrder = typeof orders.$inferInsert
export type OrderItem = typeof orderItems.$inferSelect
export type Coupon = typeof coupons.$inferSelect
export type Review = typeof reviews.$inferSelect
export type StoreConfig = typeof storeConfig.$inferSelect
