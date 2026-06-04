import { describe, it, expect } from 'vitest'
import { contrastColor } from './utils'
import { calculateTax, calculateGrandTotal } from './utils/index'

describe('contrastColor', () => {
  it('returns white on dark backgrounds', () => {
    expect(contrastColor('#000000')).toBe('#ffffff')
    expect(contrastColor('#18181b')).toBe('#ffffff')
    expect(contrastColor('#065f46')).toBe('#ffffff')
  })
  it('returns black on light backgrounds', () => {
    expect(contrastColor('#ffffff')).toBe('#000000')
    expect(contrastColor('#fafafa')).toBe('#000000')
    expect(contrastColor('#f3f4f6')).toBe('#000000')
  })
  it('handles mid-tones correctly', () => {
    // #6366f1 luminance ≈ 0.185 (just above threshold) → dark text
    expect(contrastColor('#6366f1')).toBe('#000000')
    expect(contrastColor('#10b981')).toBe('#000000')
  })
})

describe('calculateTax', () => {
  const base = { shippingCents: 250, discountCents: 0, taxBasis: 'subtotal', taxInclusive: false }

  it('returns 0 when taxRate is 0', () => {
    expect(calculateTax({ ...base, subtotalCents: 5000, taxRate: 0, taxInclusive: false })).toBe(0)
  })

  it('exclusive 17% on subtotal, no discount', () => {
    // 5000 × 0.17 = 850
    expect(calculateTax({ ...base, subtotalCents: 5000, taxRate: 17, taxInclusive: false })).toBe(850)
  })

  it('exclusive 17% applies to post-discount base', () => {
    // (5000 - 500) × 0.17 = 4500 × 0.17 = 765
    expect(calculateTax({ ...base, subtotalCents: 5000, discountCents: 500, taxRate: 17, taxInclusive: false })).toBe(765)
  })

  it('exclusive 17% on subtotal_and_shipping basis', () => {
    // (4500 + 250) × 0.17 = 4750 × 0.17 = 807.5 → round → 808
    expect(calculateTax({ ...base, subtotalCents: 5000, discountCents: 500, taxRate: 17, taxBasis: 'subtotal_and_shipping', taxInclusive: false })).toBe(808)
  })

  it('inclusive 20% extracts tax from post-discount base', () => {
    // 1200 - 1200/1.2 = 1200 - 1000 = 200
    expect(calculateTax({ ...base, subtotalCents: 1200, taxRate: 20, taxInclusive: true })).toBe(200)
  })

  it('clamps to 0 when discount exceeds subtotal', () => {
    expect(calculateTax({ ...base, subtotalCents: 500, discountCents: 600, taxRate: 17, taxInclusive: false })).toBe(0)
  })
})

describe('calculateGrandTotal', () => {
  it('exclusive: adds taxCents to total', () => {
    // 5000 + 250 - 500 + 850 = 5600
    expect(calculateGrandTotal(5000, 250, 500, 850, false)).toBe(5600)
  })

  it('inclusive: taxCents ignored (already in subtotal)', () => {
    // 5000 + 250 - 0 = 5250, taxCents 850 not added
    expect(calculateGrandTotal(5000, 250, 0, 850, true)).toBe(5250)
  })

  it('clamps to 0 on negative result', () => {
    expect(calculateGrandTotal(100, 0, 500, 0, false)).toBe(0)
  })
})
