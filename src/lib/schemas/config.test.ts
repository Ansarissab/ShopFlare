import { describe, it, expect } from 'vitest'
import { updateConfigSchema } from './admin'
import { announcementMessageSchema, storeConfigSchema } from './config'
import {
  MIN_PRODUCT_PAGE_SIZE,
  MAX_PRODUCT_PAGE_SIZE,
  DEFAULT_PRODUCT_PAGE_SIZE,
} from '@/lib/constants'

// Phase 15 — the admin page-size setting is persisted through the shared config
// schema (PUT /api/admin/config → updateConfigSchema). These guard its bounds so
// the storefront never receives an out-of-range pagination size.

describe('updateConfigSchema · productPageSize', () => {
  it('accepts the default value', () => {
    const r = updateConfigSchema.safeParse({ productPageSize: DEFAULT_PRODUCT_PAGE_SIZE })
    expect(r.success).toBe(true)
  })

  it('accepts the min and max bounds', () => {
    expect(updateConfigSchema.safeParse({ productPageSize: MIN_PRODUCT_PAGE_SIZE }).success).toBe(
      true,
    )
    expect(updateConfigSchema.safeParse({ productPageSize: MAX_PRODUCT_PAGE_SIZE }).success).toBe(
      true,
    )
  })

  it('rejects values below the minimum', () => {
    expect(
      updateConfigSchema.safeParse({ productPageSize: MIN_PRODUCT_PAGE_SIZE - 1 }).success,
    ).toBe(false)
  })

  it('rejects values above the maximum', () => {
    expect(
      updateConfigSchema.safeParse({ productPageSize: MAX_PRODUCT_PAGE_SIZE + 1 }).success,
    ).toBe(false)
  })

  it('rejects non-integer values', () => {
    expect(updateConfigSchema.safeParse({ productPageSize: 24.5 }).success).toBe(false)
  })

  it('is optional — omitting it still validates', () => {
    expect(updateConfigSchema.safeParse({ storeName: 'Acme' }).success).toBe(true)
  })
})

// ─── i18n locale invariants (enforced on updateConfigSchema) ─────────────────
// Refinements live on updateConfigSchema (not storeConfigSchema) because Zod v4
// forbids calling .partial() on a refined schema — it would throw at build time.

describe('updateConfigSchema · i18n locale invariants', () => {
  it('accepts valid enabledLocales that includes en', () => {
    expect(updateConfigSchema.safeParse({ enabledLocales: ['en'] }).success).toBe(true)
    expect(updateConfigSchema.safeParse({ enabledLocales: ['en', 'fr', 'ur'] }).success).toBe(true)
  })

  it('accepts defaultLocale that is in enabledLocales', () => {
    expect(
      updateConfigSchema.safeParse({ enabledLocales: ['en', 'fr'], defaultLocale: 'fr' }).success,
    ).toBe(true)
  })

  it('rejects enabledLocales without en', () => {
    const r = updateConfigSchema.safeParse({ enabledLocales: ['fr'] })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0].path).toContain('enabledLocales')
    }
  })

  it('rejects defaultLocale not in enabledLocales', () => {
    const r = updateConfigSchema.safeParse({ enabledLocales: ['en'], defaultLocale: 'ur' })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0].path).toContain('defaultLocale')
    }
  })

  it('is lenient when both fields are absent (partial update)', () => {
    // A partial PUT with neither field must still pass
    expect(updateConfigSchema.safeParse({ storeName: 'Acme' }).success).toBe(true)
    expect(updateConfigSchema.safeParse({}).success).toBe(true)
  })

  it('is lenient when only defaultLocale is absent (locale list update only)', () => {
    // enabledLocales present with en, defaultLocale absent — valid
    expect(updateConfigSchema.safeParse({ enabledLocales: ['en', 'fr'] }).success).toBe(true)
  })

  it('is lenient when only enabledLocales is absent (default locale update only)', () => {
    // defaultLocale present but enabledLocales absent — cross-check skipped (can't know what's stored)
    expect(updateConfigSchema.safeParse({ defaultLocale: 'fr' }).success).toBe(true)
  })
})

// ─── announcementMessageSchema · link XSS guard ───────────────────────────────

describe('announcementMessageSchema · link XSS guard', () => {
  it('accepts undefined link (optional)', () => {
    expect(announcementMessageSchema.safeParse({ text: 'Hello' }).success).toBe(true)
  })

  it('accepts root-relative path (/shop)', () => {
    expect(announcementMessageSchema.safeParse({ text: 'Hi', link: '/shop' }).success).toBe(true)
  })

  it('accepts https URL', () => {
    expect(
      announcementMessageSchema.safeParse({ text: 'Hi', link: 'https://example.com/promo' })
        .success,
    ).toBe(true)
  })

  it('accepts http URL', () => {
    expect(
      announcementMessageSchema.safeParse({ text: 'Hi', link: 'http://example.com' }).success,
    ).toBe(true)
  })

  it('rejects javascript: URI', () => {
    // eslint-disable-next-line no-script-url
    const r = announcementMessageSchema.safeParse({ text: 'Hi', link: 'javascript:alert(1)' })
    expect(r.success).toBe(false)
  })

  it('rejects data: URI', () => {
    const r = announcementMessageSchema.safeParse({
      text: 'Hi',
      link: 'data:text/html,<script>alert(1)</script>',
    })
    expect(r.success).toBe(false)
  })

  it('rejects vbscript: URI', () => {
    const r = announcementMessageSchema.safeParse({ text: 'Hi', link: 'vbscript:msgbox(1)' })
    expect(r.success).toBe(false)
  })

  it('rejects bare relative path (no leading slash)', () => {
    const r = announcementMessageSchema.safeParse({ text: 'Hi', link: 'shop/deals' })
    expect(r.success).toBe(false)
  })
})

// ─── storeConfigSchema GET-assembly smoke ─────────────────────────────────────
// The assembled defaults from worker/routes/config.ts must parse clean against
// storeConfigSchema (no refinements on it — these are the full response fields).

describe('storeConfigSchema · default assembly round-trip', () => {
  it('accepts the default assembled shape (en floor, en default)', () => {
    const r = storeConfigSchema.safeParse({
      storeName: 'ShopFlare',
      currency: 'PKR',
      freeShippingThresholdCents: 0,
      flatShippingRateCents: 0,
      primaryColor: '#1A1A18',
      accentColor: '#4A7C6F',
      radius: 'md',
      fontFamily: 'sans',
      colorMode: 'light',
      density: 'comfortable',
      heroStyle: 'image-left',
      taxEnabled: false,
      taxRate: 0,
      taxName: 'Tax',
      taxInclusive: false,
      taxBasis: 'subtotal',
      whatsappEnabled: false,
      reviewsEnabled: true,
      landingEnabled: false,
      blogEnabled: false,
      llmDiscoveryEnabled: true,
      faqEnabled: false,
      aiTrainingAllowed: true,
      enabledLocales: ['en'],
      defaultLocale: 'en',
    })
    expect(r.success).toBe(true)
  })
})
