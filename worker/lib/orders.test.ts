import { describe, it, expect } from 'vitest'
import { evaluateCoupon } from 'worker/lib/orders'
import type * as schema from 'worker/db/schema'

type Coupon = typeof schema.coupons.$inferSelect

// Factory: a valid baseline coupon; override per-test.
function coupon(overrides: Partial<Coupon> = {}): Coupon {
  return {
    id: 'c1',
    code: 'SAVE10',
    type: 'percentage',
    value: 10,
    minOrderCents: null,
    maxDiscountCents: null,
    usageLimit: null,
    perCustomerLimit: 1,
    usedCount: 0,
    expiresAt: null,
    stripeCouponId: null,
    stripePromotionCodeId: null,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

const NOW = '2026-06-02T00:00:00.000Z'

describe('evaluateCoupon', () => {
  it('rejects missing coupon', () => {
    expect(evaluateCoupon(null, 1000, NOW)).toEqual({ ok: false, message: 'Coupon not found or inactive' })
  })

  it('rejects inactive coupon', () => {
    expect(evaluateCoupon(coupon({ active: false }), 1000, NOW).ok).toBe(false)
  })

  it('computes percentage discount (floored)', () => {
    expect(evaluateCoupon(coupon({ type: 'percentage', value: 10 }), 999, NOW)).toEqual({ ok: true, discountCents: 99 })
  })

  it('computes fixed discount', () => {
    expect(evaluateCoupon(coupon({ type: 'fixed', value: 500 }), 3000, NOW)).toEqual({ ok: true, discountCents: 500 })
  })

  it('caps discount at maxDiscountCents', () => {
    const r = evaluateCoupon(coupon({ type: 'percentage', value: 50, maxDiscountCents: 200 }), 1000, NOW)
    expect(r).toEqual({ ok: true, discountCents: 200 })
  })

  it('rejects when subtotal below minOrderCents', () => {
    expect(evaluateCoupon(coupon({ minOrderCents: 5000 }), 1000, NOW).ok).toBe(false)
  })

  it('rejects when usage limit reached', () => {
    expect(evaluateCoupon(coupon({ usageLimit: 5, usedCount: 5 }), 1000, NOW).ok).toBe(false)
  })

  it('rejects expired coupon', () => {
    expect(evaluateCoupon(coupon({ expiresAt: '2026-01-01T00:00:00.000Z' }), 1000, NOW).ok).toBe(false)
  })

  it('accepts coupon expiring in the future', () => {
    expect(evaluateCoupon(coupon({ expiresAt: '2027-01-01T00:00:00.000Z' }), 1000, NOW).ok).toBe(true)
  })
})
