import { describe, it, expect } from 'vitest'
import {
  landingSectionBaseSchema,
  heroSectionSchema,
  storySectionSchema,
  featuredSectionSchema,
  SECTION_SCHEMAS,
  featuredProductsSchema,
  sectionKeySchema,
} from '@/lib/schemas/landing'
import { LANDING_SECTION_KEYS } from '@/lib/constants'

describe('landingSectionBaseSchema', () => {
  it('parses empty object (all fields optional)', () => {
    expect(landingSectionBaseSchema.safeParse({}).success).toBe(true)
  })

  it('enforces heading max length', () => {
    const r = landingSectionBaseSchema.safeParse({ heading: 'x'.repeat(201) })
    expect(r.success).toBe(false)
  })

  it('enforces subtext max length', () => {
    const r = landingSectionBaseSchema.safeParse({ subtext: 'x'.repeat(501) })
    expect(r.success).toBe(false)
  })

  it('enforces ctaText max length', () => {
    const r = landingSectionBaseSchema.safeParse({ ctaText: 'x'.repeat(101) })
    expect(r.success).toBe(false)
  })
})

describe('heroSectionSchema', () => {
  it('accepts all hero fields', () => {
    const r = heroSectionSchema.safeParse({
      enabled: true,
      heading: 'Hero',
      subtext: 'Sub',
      ctaText: 'Buy',
      ctaHref: '/shop',
      imageR2Key: 'img/hero.avif',
    })
    expect(r.success).toBe(true)
  })

  it('strips bodyHtml (not in hero pick)', () => {
    const r = heroSectionSchema.safeParse({ bodyHtml: '<p>text</p>' })
    expect(r.success).toBe(true)
    expect((r.data as Record<string, unknown>)?.bodyHtml).toBeUndefined()
  })
})

describe('storySectionSchema', () => {
  it('accepts heading + bodyHtml + imageR2Key', () => {
    const r = storySectionSchema.safeParse({
      heading: 'Our Story',
      bodyHtml: '<p>story</p>',
      imageR2Key: 'k',
    })
    expect(r.success).toBe(true)
  })

  it('strips ctaText (not in story pick)', () => {
    const r = storySectionSchema.safeParse({ ctaText: 'nope' })
    expect(r.success).toBe(true)
    expect((r.data as Record<string, unknown>)?.ctaText).toBeUndefined()
  })
})

describe('featuredSectionSchema', () => {
  it('only allows enabled + heading', () => {
    const r = featuredSectionSchema.safeParse({
      enabled: true,
      heading: 'Featured',
      ctaHref: '/nope',
    })
    expect(r.success).toBe(true)
    expect((r.data as Record<string, unknown>)?.ctaHref).toBeUndefined()
  })
})

describe('SECTION_SCHEMAS', () => {
  it('covers every LANDING_SECTION_KEY', () => {
    for (const key of LANDING_SECTION_KEYS) {
      expect(SECTION_SCHEMAS[key]).toBeDefined()
    }
  })

  it('each key maps to a Zod schema with a safeParse method', () => {
    for (const key of LANDING_SECTION_KEYS) {
      expect(typeof SECTION_SCHEMAS[key].safeParse).toBe('function')
    }
  })
})

describe('featuredProductsSchema', () => {
  it('accepts an array of product id strings', () => {
    const r = featuredProductsSchema.safeParse({ productIds: ['abc', 'def'] })
    expect(r.success).toBe(true)
    expect(r.data?.productIds).toEqual(['abc', 'def'])
  })

  it('rejects more than 20 product IDs', () => {
    const r = featuredProductsSchema.safeParse({
      productIds: Array.from({ length: 21 }, (_, i) => `p${i}`),
    })
    expect(r.success).toBe(false)
  })

  it('rejects empty string product IDs', () => {
    const r = featuredProductsSchema.safeParse({ productIds: [''] })
    expect(r.success).toBe(false)
  })
})

describe('sectionKeySchema', () => {
  it('accepts every LANDING_SECTION_KEY', () => {
    for (const key of LANDING_SECTION_KEYS) {
      expect(sectionKeySchema.safeParse(key).success).toBe(true)
    }
  })

  it('rejects unknown keys', () => {
    expect(sectionKeySchema.safeParse('banner').success).toBe(false)
    expect(sectionKeySchema.safeParse('').success).toBe(false)
  })
})
