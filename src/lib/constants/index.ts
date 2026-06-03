export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const PAYMENT_METHODS = [
  'stripe_checkout',
  'cod',
  'bank_transfer',
  'whatsapp',
  'in_person_cash',
] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const CURRENCIES = {
  PKR: { symbol: '₨', code: 'PKR', name: 'Pakistani Rupee', decimals: 0 },
  USD: { symbol: '$',  code: 'USD', name: 'US Dollar',        decimals: 2 },
  GBP: { symbol: '£',  code: 'GBP', name: 'British Pound',    decimals: 2 },
  EUR: { symbol: '€',  code: 'EUR', name: 'Euro',             decimals: 2 },
  AED: { symbol: 'د.إ', code: 'AED', name: 'UAE Dirham',      decimals: 2 },
  BDT: { symbol: '৳',  code: 'BDT', name: 'Bangladeshi Taka', decimals: 0 },
  SAR: { symbol: '﷼',  code: 'SAR', name: 'Saudi Riyal',      decimals: 2 },
} as const
export type CurrencyCode = keyof typeof CURRENCIES

export const DEFAULT_CURRENCY: CurrencyCode = 'PKR'

export const MAX_VARIANTS = 5
export const MAX_IMAGES_PER_VARIANT = 5
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5 MB — server-side upload cap
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const
export const MAX_COUPON_CODE_LENGTH = 20
export const MIN_COUPON_CODE_LENGTH = 6
export const FREE_SHIPPING_DEFAULT_THRESHOLD = 0  // 0 = disabled
export const LOW_STOCK_THRESHOLD = 5
export const MAX_CART_ITEMS = 50

export const POLICY_SLUGS = ['shipping', 'returns', 'privacy', 'terms'] as const
export type PolicySlug = (typeof POLICY_SLUGS)[number]

// ─── Analytics ────────────────────────────────────────────────────────────────

export const ANALYTICS_PERIODS = ['7d', '30d', '90d', 'all'] as const
export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number]

export const ANALYTICS_TABS = ['overview', 'products', 'customers', 'funnel'] as const
export type AnalyticsTab = (typeof ANALYTICS_TABS)[number]

export const ABANDONMENT_HOURS = 24
export const AFFINITY_PAIR_LIMIT = 20
export const SLOW_MOVERS_LIMIT = 10
export const TOP_CUSTOMERS_LIMIT = 20
export const EVENT_SAMPLE_RATE = 0.2

export const RFM_RECENCY_DAYS_HIGH = 30
export const RFM_RECENCY_DAYS_MED  = 90
export const RFM_FREQUENCY_HIGH    = 3
export const RFM_FREQUENCY_MED     = 2

export const FUNNEL_METRICS = ['product_view', 'add_to_cart', 'checkout_start', 'purchase'] as const
export type FunnelMetric = (typeof FUNNEL_METRICS)[number]
