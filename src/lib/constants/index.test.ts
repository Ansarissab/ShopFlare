import { describe, it, expect } from 'vitest'
import {
  FEATURE_FLAGS,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  CURRENCIES,
  DEFAULT_CURRENCY,
  MAX_VARIANTS,
  MAX_IMAGES_PER_VARIANT,
  MAX_IMAGE_BYTES,
  ALLOWED_IMAGE_TYPES,
  MAX_COUPON_CODE_LENGTH,
  MIN_COUPON_CODE_LENGTH,
  FREE_SHIPPING_DEFAULT_THRESHOLD,
  LOW_STOCK_THRESHOLD,
  MAX_CART_ITEMS,
  POLICY_SLUGS,
  ANALYTICS_PERIODS,
  ANALYTICS_TABS,
  FUNNEL_METRICS,
  RADIUS_PRESETS,
  FONT_PRESETS,
  COLOR_MODES,
  THEME_PRESETS,
  STYLE_PRESETS,
  DENSITY_PRESETS,
  HERO_STYLES,
  LANDING_SECTION_KEYS,
  TAX_BASIS,
  SW_CACHE_NAMES,
  TAB_ROUTES,
  PWA_MANIFEST_DEFAULTS,
  CATEGORY_SLUG_PATTERN,
  DEFAULT_PRODUCT_PAGE_SIZE,
  MIN_PRODUCT_PAGE_SIZE,
  MAX_PRODUCT_PAGE_SIZE,
  SEARCH_DEBOUNCE_MS,
  AI_SEARCH_BOTS,
  AI_TRAINING_BOTS,
  BLOCKED_SCRAPER_BOTS,
} from '@/lib/constants'

describe('order + payment enums', () => {
  it('ORDER_STATUSES covers the lifecycle in order', () => {
    expect(ORDER_STATUSES).toEqual([
      'pending',
      'confirmed',
      'processing',
      'shipped',
      'delivered',
      'cancelled',
    ])
  })

  it('PAYMENT_METHODS includes stripe + cod', () => {
    expect(PAYMENT_METHODS).toContain('stripe_checkout')
    expect(PAYMENT_METHODS).toContain('cod')
    expect(PAYMENT_METHODS.length).toBe(5)
  })
})

describe('CURRENCIES', () => {
  it('default currency exists in the map', () => {
    expect(DEFAULT_CURRENCY).toBe('PKR')
    expect(CURRENCIES[DEFAULT_CURRENCY]).toBeDefined()
  })

  it('each currency carries symbol/code/name/decimals with code matching its key', () => {
    for (const [key, c] of Object.entries(CURRENCIES)) {
      expect(c.code).toBe(key)
      expect(typeof c.symbol).toBe('string')
      expect(typeof c.name).toBe('string')
      expect([0, 2]).toContain(c.decimals)
    }
  })

  it('PKR and BDT are zero-decimal; USD is two-decimal', () => {
    expect(CURRENCIES.PKR.decimals).toBe(0)
    expect(CURRENCIES.BDT.decimals).toBe(0)
    expect(CURRENCIES.USD.decimals).toBe(2)
  })
})

describe('numeric caps + thresholds', () => {
  it('coupon bounds are ordered', () => {
    expect(MIN_COUPON_CODE_LENGTH).toBeLessThan(MAX_COUPON_CODE_LENGTH)
    expect(MIN_COUPON_CODE_LENGTH).toBe(6)
    expect(MAX_COUPON_CODE_LENGTH).toBe(20)
  })

  it('image byte cap is 5MB', () => {
    expect(MAX_IMAGE_BYTES).toBe(5 * 1024 * 1024)
  })

  it('product page size bounds are ordered', () => {
    expect(MIN_PRODUCT_PAGE_SIZE).toBeLessThanOrEqual(DEFAULT_PRODUCT_PAGE_SIZE)
    expect(DEFAULT_PRODUCT_PAGE_SIZE).toBeLessThanOrEqual(MAX_PRODUCT_PAGE_SIZE)
  })

  it('misc caps hold expected values', () => {
    expect(MAX_VARIANTS).toBe(5)
    expect(MAX_IMAGES_PER_VARIANT).toBe(5)
    expect(FREE_SHIPPING_DEFAULT_THRESHOLD).toBe(0)
    expect(LOW_STOCK_THRESHOLD).toBe(5)
    expect(MAX_CART_ITEMS).toBe(50)
    expect(SEARCH_DEBOUNCE_MS).toBe(250)
  })

  it('allowed image types include modern formats', () => {
    expect(ALLOWED_IMAGE_TYPES).toContain('image/webp')
    expect(ALLOWED_IMAGE_TYPES).toContain('image/avif')
  })
})

describe('slug + analytics enums', () => {
  it('POLICY_SLUGS lists the four policy pages', () => {
    expect(POLICY_SLUGS).toEqual(['shipping', 'returns', 'privacy', 'terms'])
  })

  it('analytics period/tab/funnel enums populated', () => {
    expect(ANALYTICS_PERIODS).toContain('all')
    expect(ANALYTICS_TABS).toContain('overview')
    expect(FUNNEL_METRICS[0]).toBe('product_view')
    expect(FUNNEL_METRICS[FUNNEL_METRICS.length - 1]).toBe('purchase')
  })
})

describe('appearance presets', () => {
  it('radius presets cover none..full', () => {
    expect(Object.keys(RADIUS_PRESETS)).toEqual(['none', 'sm', 'md', 'lg', 'full'])
    expect(RADIUS_PRESETS.none).toBe('0rem')
  })

  it('font presets resolve to css vars', () => {
    expect(FONT_PRESETS.sans).toContain('var(--font')
    expect(Object.keys(FONT_PRESETS)).toEqual(['sans', 'mono'])
  })

  it('color modes include system', () => {
    expect(COLOR_MODES).toEqual(['light', 'dark', 'system'])
  })

  it('every theme preset has a name + two hex colors', () => {
    expect(THEME_PRESETS.length).toBe(STYLE_PRESETS.length)
    for (const p of THEME_PRESETS) {
      expect(p.name.length).toBeGreaterThan(0)
      expect(p.primaryColor).toMatch(/^#[0-9a-f]{6}$/i)
      expect(p.accentColor).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})

describe('tax + pwa', () => {
  it('TAX_BASIS keys map to snake-case values', () => {
    expect(TAX_BASIS.subtotal).toBe('subtotal')
    expect(TAX_BASIS.subtotalAndShipping).toBe('subtotal_and_shipping')
  })

  it('SW cache names are versioned', () => {
    for (const v of Object.values(SW_CACHE_NAMES)) {
      expect(v).toMatch(/shopflare-.*-v1$/)
    }
  })

  it('manifest defaults provide icons + theme colors', () => {
    expect(PWA_MANIFEST_DEFAULTS.icon512).toBe('/icon-512.png')
    expect(PWA_MANIFEST_DEFAULTS.themeColor).toMatch(/^#[0-9a-f]{6}$/i)
  })
})

describe('TAB_ROUTES', () => {
  it('cart + menu use null href (sheet triggers); others have a route', () => {
    const cart = TAB_ROUTES.find((t) => t.key === 'cart')
    const home = TAB_ROUTES.find((t) => t.key === 'home')
    expect(cart?.href).toBeNull()
    expect(home?.href).toBe('/')
  })

  it('every tab carries a labelKey', () => {
    for (const t of TAB_ROUTES) {
      expect(typeof t.labelKey).toBe('string')
    }
  })
})

describe('FEATURE_FLAGS', () => {
  it('reviews + llmDiscovery on by default', () => {
    expect(FEATURE_FLAGS.reviewsEnabled).toBe(true)
    expect(FEATURE_FLAGS.llmDiscoveryEnabled).toBe(true)
  })

  it('whatsapp, landing, blog off by default', () => {
    expect(FEATURE_FLAGS.whatsappEnabled).toBe(false)
    expect(FEATURE_FLAGS.landingEnabled).toBe(false)
    expect(FEATURE_FLAGS.blogEnabled).toBe(false)
  })
})

describe('CATEGORY_SLUG_PATTERN', () => {
  it('accepts lowercase hyphenated slugs', () => {
    expect(CATEGORY_SLUG_PATTERN.test('mens-shoes')).toBe(true)
    expect(CATEGORY_SLUG_PATTERN.test('shoes')).toBe(true)
  })

  it('rejects leading/trailing hyphen, uppercase and spaces', () => {
    expect(CATEGORY_SLUG_PATTERN.test('-shoes')).toBe(false)
    expect(CATEGORY_SLUG_PATTERN.test('shoes-')).toBe(false)
    expect(CATEGORY_SLUG_PATTERN.test('Mens Shoes')).toBe(false)
  })
})

describe('AI bot user-agent lists', () => {
  it('AI_SEARCH_BOTS is a non-empty array', () => {
    expect(Array.isArray(AI_SEARCH_BOTS)).toBe(true)
    expect(AI_SEARCH_BOTS.length).toBeGreaterThan(0)
  })

  it('AI_SEARCH_BOTS includes well-known answer bots', () => {
    expect(AI_SEARCH_BOTS).toContain('PerplexityBot')
    expect(AI_SEARCH_BOTS).toContain('OAI-SearchBot')
    expect(AI_SEARCH_BOTS).toContain('Claude-SearchBot')
  })

  it('AI_TRAINING_BOTS is a non-empty array', () => {
    expect(Array.isArray(AI_TRAINING_BOTS)).toBe(true)
    expect(AI_TRAINING_BOTS.length).toBeGreaterThan(0)
  })

  it('AI_TRAINING_BOTS includes well-known training crawlers', () => {
    expect(AI_TRAINING_BOTS).toContain('GPTBot')
    expect(AI_TRAINING_BOTS).toContain('Google-Extended')
    expect(AI_TRAINING_BOTS).toContain('CCBot')
  })

  it('BLOCKED_SCRAPER_BOTS is a non-empty array', () => {
    expect(Array.isArray(BLOCKED_SCRAPER_BOTS)).toBe(true)
    expect(BLOCKED_SCRAPER_BOTS.length).toBeGreaterThan(0)
  })

  it('BLOCKED_SCRAPER_BOTS includes known SEO crawlers', () => {
    expect(BLOCKED_SCRAPER_BOTS).toContain('AhrefsBot')
    expect(BLOCKED_SCRAPER_BOTS).toContain('SemrushBot')
  })

  it('three lists are mutually disjoint', () => {
    const searchSet: Set<string> = new Set(AI_SEARCH_BOTS)
    const trainingSet: Set<string> = new Set(AI_TRAINING_BOTS)
    const scraperSet: Set<string> = new Set(BLOCKED_SCRAPER_BOTS)
    for (const bot of AI_SEARCH_BOTS) {
      expect(trainingSet.has(bot)).toBe(false)
      expect(scraperSet.has(bot)).toBe(false)
    }
    for (const bot of AI_TRAINING_BOTS) {
      expect(searchSet.has(bot)).toBe(false)
      expect(scraperSet.has(bot)).toBe(false)
    }
  })
})

describe('LANDING_SECTION_KEYS', () => {
  it('contains the 5 expected section keys', () => {
    expect(LANDING_SECTION_KEYS).toContain('hero')
    expect(LANDING_SECTION_KEYS).toContain('story')
    expect(LANDING_SECTION_KEYS).toContain('featured')
    expect(LANDING_SECTION_KEYS).toContain('reviews')
    expect(LANDING_SECTION_KEYS).toContain('cta')
    expect(LANDING_SECTION_KEYS).toHaveLength(5)
  })
})

describe('DENSITY_PRESETS', () => {
  it('has compact, comfortable and spacious entries', () => {
    expect(DENSITY_PRESETS).toHaveProperty('compact')
    expect(DENSITY_PRESETS).toHaveProperty('comfortable')
    expect(DENSITY_PRESETS).toHaveProperty('spacious')
  })

  it('comfortable is the neutral scale 1', () => {
    expect(DENSITY_PRESETS.comfortable).toBe('1')
  })

  it('compact is smaller than comfortable, spacious is larger', () => {
    expect(Number(DENSITY_PRESETS.compact)).toBeLessThan(1)
    expect(Number(DENSITY_PRESETS.spacious)).toBeGreaterThan(1)
  })
})

describe('HERO_STYLES', () => {
  it('includes the 4 supported hero layouts', () => {
    expect(HERO_STYLES).toContain('image-left')
    expect(HERO_STYLES).toContain('full-bleed')
    expect(HERO_STYLES).toContain('centered')
    expect(HERO_STYLES).toContain('split')
    expect(HERO_STYLES).toHaveLength(4)
  })
})

describe('STYLE_PRESETS', () => {
  it('provides 6 named presets', () => {
    expect(STYLE_PRESETS).toHaveLength(6)
  })

  it('each preset has all 6 required appearance fields', () => {
    for (const p of STYLE_PRESETS) {
      expect(p).toHaveProperty('name')
      expect(p).toHaveProperty('primaryColor')
      expect(p).toHaveProperty('accentColor')
      expect(p).toHaveProperty('fontFamily')
      expect(p).toHaveProperty('radius')
      expect(p).toHaveProperty('density')
      expect(p).toHaveProperty('heroStyle')
    }
  })

  it('every preset color is a valid #rrggbb hex', () => {
    for (const p of STYLE_PRESETS) {
      expect(p.primaryColor).toMatch(/^#[0-9a-f]{6}$/i)
      expect(p.accentColor).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('THEME_PRESETS is derived from STYLE_PRESETS with matching names', () => {
    expect(THEME_PRESETS).toHaveLength(STYLE_PRESETS.length)
    for (let i = 0; i < STYLE_PRESETS.length; i++) {
      expect(THEME_PRESETS[i].name).toBe(STYLE_PRESETS[i].name)
      expect(THEME_PRESETS[i].primaryColor).toBe(STYLE_PRESETS[i].primaryColor)
      expect(THEME_PRESETS[i].accentColor).toBe(STYLE_PRESETS[i].accentColor)
    }
  })
})
