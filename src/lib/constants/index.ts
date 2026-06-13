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
  USD: { symbol: '$', code: 'USD', name: 'US Dollar', decimals: 2 },
  GBP: { symbol: '£', code: 'GBP', name: 'British Pound', decimals: 2 },
  EUR: { symbol: '€', code: 'EUR', name: 'Euro', decimals: 2 },
  AED: { symbol: 'د.إ', code: 'AED', name: 'UAE Dirham', decimals: 2 },
  BDT: { symbol: '৳', code: 'BDT', name: 'Bangladeshi Taka', decimals: 0 },
  SAR: { symbol: '﷼', code: 'SAR', name: 'Saudi Riyal', decimals: 2 },
} as const
export type CurrencyCode = keyof typeof CURRENCIES

export const DEFAULT_CURRENCY: CurrencyCode = 'PKR'

export const MAX_VARIANTS = 5
export const MAX_IMAGES_PER_VARIANT = 5
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5 MB — server-side upload cap
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const
export const MAX_COUPON_CODE_LENGTH = 20
export const MIN_COUPON_CODE_LENGTH = 6
export const FREE_SHIPPING_DEFAULT_THRESHOLD = 0 // 0 = disabled
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
export const RFM_RECENCY_DAYS_MED = 90
export const RFM_FREQUENCY_HIGH = 3
export const RFM_FREQUENCY_MED = 2

export const FUNNEL_METRICS = ['product_view', 'add_to_cart', 'checkout_start', 'purchase'] as const
export type FunnelMetric = (typeof FUNNEL_METRICS)[number]

// ─── Appearance / Theme ───────────────────────────────────────────────────────

export const RADIUS_PRESETS = {
  none: '0rem',
  sm: '0.25rem',
  md: '0.5rem',
  lg: '0.75rem',
  full: '1.5rem',
} as const
export type RadiusPreset = keyof typeof RADIUS_PRESETS

// key maps to the CSS variable emitted by next/font in the root layout
export const FONT_PRESETS = {
  sans: 'var(--font-geist-sans)',
  serif: 'var(--font-merriweather)',
  mono: 'var(--font-geist-mono)',
  rounded: 'var(--font-nunito)',
} as const
export type FontPreset = keyof typeof FONT_PRESETS

export const COLOR_MODES = ['light', 'dark', 'system'] as const
export type ColorMode = (typeof COLOR_MODES)[number]

export const DENSITY_PRESETS = {
  compact: '0.75',
  comfortable: '1',
  spacious: '1.25',
} as const
export type DensityPreset = keyof typeof DENSITY_PRESETS

export const HERO_STYLES = ['image-left', 'full-bleed', 'centered', 'split'] as const
export type HeroStyle = (typeof HERO_STYLES)[number]

// Full style presets — each bundles all appearance vars.
// Supersedes the old color-only THEME_PRESETS (kept for backwards compat).
export const STYLE_PRESETS = [
  {
    name: 'Midnight',
    primaryColor: '#1A1A18',
    accentColor: '#4A7C6F',
    fontFamily: 'sans' as const,
    radius: 'md' as const,
    density: 'comfortable' as const,
    heroStyle: 'image-left' as const,
  },
  {
    name: 'Emerald',
    primaryColor: '#065f46',
    accentColor: '#10b981',
    fontFamily: 'sans' as const,
    radius: 'lg' as const,
    density: 'comfortable' as const,
    heroStyle: 'full-bleed' as const,
  },
  {
    name: 'Sunset',
    primaryColor: '#9a3412',
    accentColor: '#f97316',
    fontFamily: 'serif' as const,
    radius: 'none' as const,
    density: 'compact' as const,
    heroStyle: 'split' as const,
  },
  {
    name: 'Ocean',
    primaryColor: '#0c4a6e',
    accentColor: '#0ea5e9',
    fontFamily: 'sans' as const,
    radius: 'full' as const,
    density: 'spacious' as const,
    heroStyle: 'centered' as const,
  },
  {
    name: 'Elegant',
    primaryColor: '#1a1a2e',
    accentColor: '#e8d5b7',
    fontFamily: 'serif' as const,
    radius: 'sm' as const,
    density: 'spacious' as const,
    heroStyle: 'centered' as const,
  },
  {
    name: 'Playful',
    primaryColor: '#7c3aed',
    accentColor: '#f59e0b',
    fontFamily: 'rounded' as const,
    radius: 'full' as const,
    density: 'comfortable' as const,
    heroStyle: 'image-left' as const,
  },
] as const
export type StylePreset = (typeof STYLE_PRESETS)[number]

export const THEME_PRESETS = STYLE_PRESETS.map(({ name, primaryColor, accentColor }) => ({
  name,
  primaryColor,
  accentColor,
}))

// ─── Tax ─────────────────────────────────────────────────────────────────────

export const TAX_BASIS = {
  subtotal: 'subtotal',
  subtotalAndShipping: 'subtotal_and_shipping',
} as const
export type TaxBasis = keyof typeof TAX_BASIS

// ─── PWA ─────────────────────────────────────────────────────────────────────

export const SW_CACHE_NAMES = {
  precache: 'shopflare-precache-v1',
  static: 'shopflare-static-v1',
  api: 'shopflare-api-v1',
  images: 'shopflare-images-v1',
  pages: 'shopflare-pages-v1',
} as const

export const OFFLINE_QUEUE_IDB_KEY = 'offline_queue'
export const INSTALL_DISMISSED_KEY = 'pwa-install-dismissed'

// Tab routes for the native bottom nav (standalone mode)
export const TAB_ROUTES = [
  { key: 'home', href: '/', labelKey: 'tabHome' },
  { key: 'shop', href: '/shop', labelKey: 'tabShop' }, // /shop when landingEnabled, / when off — AppTabBar resolves via catalogHref
  { key: 'cart', href: null, labelKey: 'tabCart' }, // null = triggers CartSheet
  { key: 'track', href: '/track', labelKey: 'tabTrack' },
  { key: 'menu', href: null, labelKey: 'tabMenu' }, // null = triggers menu sheet
] as const
export type TabKey = (typeof TAB_ROUTES)[number]['key']

// Default manifest values (used when merchant hasn't configured custom icons)
export const PWA_MANIFEST_DEFAULTS = {
  iconSrc: '/icon-512.png',
  icon192: '/icon-192.png',
  icon512: '/icon-512.png',
  iconMaskable: '/icon-maskable-512.png',
  iconMonochrome: '/icon-monochrome-192.png',
  appleTouchIcon: '/apple-touch-icon.png',
  backgroundColor: '#141412',
  themeColor: '#1A1A18',
} as const

// ─── Search + pagination ──────────────────────────────────────────────────────
export const DEFAULT_PRODUCT_PAGE_SIZE = 24
export const MIN_PRODUCT_PAGE_SIZE = 6
export const MAX_PRODUCT_PAGE_SIZE = 96
export const SEARCH_DEBOUNCE_MS = 250

// ─── Feature Flags ────────────────────────────────────────────────────────────

export const FEATURE_FLAGS = {
  whatsappEnabled: false, // phase 19
  reviewsEnabled: true, // phase 20 (on by default — already live)
  faqEnabled: false, // phase 21 (sitewide FAQ — off by default until merchant adds content)
  llmDiscoveryEnabled: true, // phase 21
  landingEnabled: false, // phase 22
  blogEnabled: false, // phase 23
} as const
export type FeatureFlagKey = keyof typeof FEATURE_FLAGS

// ─── AI Bot User-Agents ────────────────────────────────────────────────────────
// Search/answer bots — should always be allowed (they power citations).
export const AI_SEARCH_BOTS = [
  'OAI-SearchBot',
  'PerplexityBot',
  'Claude-SearchBot',
  'ChatGPT-User',
  'Claude-User',
  'Amazonbot',
] as const

// Training bots — governed by aiTrainingAllowed flag.
export const AI_TRAINING_BOTS = [
  'GPTBot',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
  'anthropic-ai',
  'Bytespider',
] as const

// SEO scraper bots — always blocked (crawl-budget abuse).
export const BLOCKED_SCRAPER_BOTS = ['AhrefsBot', 'SemrushBot', 'MJ12bot', 'DotBot'] as const

// ─── Landing Page ────────────────────────────────────────────────────────────

export const LANDING_SECTION_KEYS = ['hero', 'story', 'featured', 'reviews', 'cta'] as const
export type LandingSectionKey = (typeof LANDING_SECTION_KEYS)[number]

// ─── Categories ────────────────────────────────────────────────────────────────
export const MAX_CATEGORY_DEPTH = 2
export const MAX_CATEGORIES_PER_PRODUCT = 10
export const MAX_CATEGORY_NAME_LENGTH = 60
export const MAX_CATEGORY_DESCRIPTION_LENGTH = 500
export const CATEGORY_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// ─── Blog ─────────────────────────────────────────────────────────────────────

export const BLOG_STATUSES = ['draft', 'published'] as const
export type BlogStatus = (typeof BLOG_STATUSES)[number]

// ─── Health / Status ──────────────────────────────────────────────────────────
// Canonical service keys used by /healthz HealthReport and the /status page.
// Must match the keys in healthProbe() checks object.
export const HEALTH_SERVICE_KEYS = ['db', 'kv', 'r2'] as const
export type HealthServiceKey = (typeof HEALTH_SERVICE_KEYS)[number]

// ─── i18n Locales ───────────────────────────────────────────────────────────
export const LOCALES = {
  en: { code: 'en', label: 'English', dir: 'ltr' },
  fr: { code: 'fr', label: 'Français', dir: 'ltr' },
  ur: { code: 'ur', label: 'اردو', dir: 'rtl' },
} as const
export type LocaleCode = keyof typeof LOCALES
export const SHIPPED_LOCALES = Object.keys(LOCALES) as LocaleCode[]
export const DEFAULT_LOCALE: LocaleCode = 'en'
