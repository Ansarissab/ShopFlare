import { describe, it, expect } from 'vitest'
import {
  slugify,
  formatPrice,
  calculateShipping,
  calculateTax,
  calculateGrandTotal,
  buildProductMaps,
  getPriceRange,
  formatDate,
} from '@/lib/utils/index'
import type { VariantWithDetails, SizeOption } from '@/lib/types/product'

describe('slugify', () => {
  it('lowercases and hyphenates spaces', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })
  it('strips punctuation', () => {
    expect(slugify("Men's Clothing!")).toBe('men-s-clothing')
  })
  it('collapses multiple separators', () => {
    expect(slugify('foo  --  bar')).toBe('foo-bar')
  })
  it('removes leading/trailing hyphens', () => {
    expect(slugify('  -hello- ')).toBe('hello')
  })
  it('strips unicode / non-ASCII', () => {
    expect(slugify('Ñoño café')).toBe('o-o-caf')
  })
  it('truncates at 80 chars', () => {
    expect(slugify('a'.repeat(100))).toHaveLength(80)
  })
  it('returns empty string for blank input', () => {
    expect(slugify('   ')).toBe('')
  })
})

// ─── formatPrice ──────────────────────────────────────────────────────────────

describe('formatPrice', () => {
  it('uses the default currency (PKR, 0 decimals) when none passed', () => {
    // PKR has 0 decimals → cents are whole rupees
    expect(formatPrice(1500)).toBe('₨1,500')
  })

  it('formats a 2-decimal currency with explicit code', () => {
    expect(formatPrice(1234, 'USD')).toBe('$12.34')
  })

  it('formats zero', () => {
    expect(formatPrice(0, 'USD')).toBe('$0.00')
  })
})

// ─── calculateShipping ────────────────────────────────────────────────────────

describe('calculateShipping', () => {
  it('is free when threshold > 0 and subtotal meets it', () => {
    expect(calculateShipping(10000, 500, 8000)).toBe(0)
  })

  it('charges flat rate when subtotal below threshold', () => {
    expect(calculateShipping(5000, 500, 8000)).toBe(500)
  })

  it('charges flat rate when threshold is 0 (disabled), even at high subtotal', () => {
    expect(calculateShipping(99999, 500, 0)).toBe(500)
  })

  it('charges flat rate when subtotal exactly one cent below threshold', () => {
    expect(calculateShipping(7999, 500, 8000)).toBe(500)
  })
})

// ─── calculateTax ─────────────────────────────────────────────────────────────

describe('calculateTax', () => {
  const base = {
    subtotalCents: 10000,
    shippingCents: 1000,
    discountCents: 0,
    taxRate: 10,
    taxInclusive: false,
    taxBasis: 'subtotal',
  }

  it('returns 0 when taxRate <= 0', () => {
    expect(calculateTax({ ...base, taxRate: 0 })).toBe(0)
    expect(calculateTax({ ...base, taxRate: -5 })).toBe(0)
  })

  it('extracts inclusive tax from the discounted base', () => {
    // base = 10000, inclusive 10% → 10000 - 10000/1.1 = 909
    expect(calculateTax({ ...base, taxInclusive: true })).toBe(909)
  })

  it('inclusive base floors at 0 when discount exceeds subtotal', () => {
    expect(calculateTax({ ...base, taxInclusive: true, discountCents: 99999 })).toBe(0)
  })

  it('exclusive tax on subtotal only', () => {
    expect(calculateTax({ ...base, taxBasis: 'subtotal' })).toBe(1000)
  })

  it('exclusive tax includes shipping when basis is subtotal_and_shipping', () => {
    // (10000 + 1000) * 10% = 1100
    expect(calculateTax({ ...base, taxBasis: 'subtotal_and_shipping' })).toBe(1100)
  })

  it('exclusive base floors at 0 when discount exceeds subtotal', () => {
    // subtotal-discount floored to 0, plus shipping 1000 → 100
    expect(
      calculateTax({ ...base, taxBasis: 'subtotal_and_shipping', discountCents: 99999 }),
    ).toBe(100)
  })
})

// ─── calculateGrandTotal ──────────────────────────────────────────────────────

describe('calculateGrandTotal', () => {
  it('excludes tax from the sum when tax-inclusive', () => {
    expect(calculateGrandTotal(10000, 1000, 500, 909, true)).toBe(10500)
  })

  it('adds tax to the sum when tax-exclusive', () => {
    expect(calculateGrandTotal(10000, 1000, 500, 1000, false)).toBe(11500)
  })

  it('floors at 0 when discount makes inclusive total negative', () => {
    expect(calculateGrandTotal(1000, 0, 99999, 0, true)).toBe(0)
  })

  it('floors at 0 when discount makes exclusive total negative', () => {
    expect(calculateGrandTotal(1000, 0, 99999, 0, false)).toBe(0)
  })
})

// ─── buildProductMaps ─────────────────────────────────────────────────────────

describe('buildProductMaps', () => {
  it('builds empty maps for no variants', () => {
    const out = buildProductMaps([])
    expect(out).toEqual({ sizesByVariant: {}, imagesByVariant: {} })
  })

  it('keys sizes and images by variant id', () => {
    const variants = [
      { id: 'v1', sizes: [{ id: 's1' }], images: [{ id: 'i1' }] },
      { id: 'v2', sizes: [], images: [] },
    ] as unknown as VariantWithDetails[]
    const out = buildProductMaps(variants)
    expect(out.sizesByVariant.v1).toEqual([{ id: 's1' }])
    expect(out.imagesByVariant.v1).toEqual([{ id: 'i1' }])
    expect(out.sizesByVariant.v2).toEqual([])
  })
})

// ─── getPriceRange ────────────────────────────────────────────────────────────

describe('getPriceRange', () => {
  const mkSize = (over: Partial<SizeOption>): SizeOption =>
    ({ active: true, stock: 5, priceCents: 1000, ...over }) as unknown as SizeOption

  it('returns null/null when no eligible sizes', () => {
    expect(getPriceRange([])).toEqual({ minPrice: null, maxPrice: null })
  })

  it('returns null/null when all sizes inactive or out of stock', () => {
    const sizes = [mkSize({ active: false }), mkSize({ stock: 0 })]
    expect(getPriceRange(sizes)).toEqual({ minPrice: null, maxPrice: null })
  })

  it('computes min/max across eligible sizes only', () => {
    const sizes = [
      mkSize({ priceCents: 1000 }),
      mkSize({ priceCents: 3000 }),
      mkSize({ priceCents: 500, active: false }), // excluded
      mkSize({ priceCents: 200, stock: 0 }),      // excluded
    ]
    expect(getPriceRange(sizes)).toEqual({ minPrice: 1000, maxPrice: 3000 })
  })

  it('treats negative/nonzero stock as in-stock (stock !== 0)', () => {
    const sizes = [mkSize({ priceCents: 700, stock: -1 })]
    expect(getPriceRange(sizes)).toEqual({ minPrice: 700, maxPrice: 700 })
  })
})

// ─── formatDate ───────────────────────────────────────────────────────────────

describe('formatDate', () => {
  it('returns empty string for null/undefined/empty', () => {
    expect(formatDate(null)).toBe('')
    expect(formatDate(undefined)).toBe('')
    expect(formatDate('')).toBe('')
  })

  it('returns empty string for an unparseable date', () => {
    expect(formatDate('not-a-date')).toBe('')
  })

  it('normalizes a SQLite space-separated datetime (no T, no Z)', () => {
    const out = formatDate('2026-01-15 12:00:00')
    expect(out).toContain('2026')
    expect(out).toContain('Jan')
  })

  it('accepts an already-ISO string with a T', () => {
    const out = formatDate('2026-03-20T08:30:00Z')
    expect(out).toContain('Mar')
  })

  it('honors custom format options', () => {
    const out = formatDate('2026-01-15T00:00:00Z', { year: 'numeric' })
    expect(out).toBe('2026')
  })
})
