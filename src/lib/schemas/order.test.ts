import { describe, it, expect } from 'vitest'
import { codOrderSchema } from '@/lib/schemas'

const validAddress = {
  name: 'Jane Doe',
  phone: '+923001234567',
  address: '12 Market Road',
  city: 'Karachi',
  country: 'PK',
}

describe('codOrderSchema', () => {
  it('accepts a valid COD order', () => {
    const r = codOrderSchema.safeParse({
      items: [{ sizeOptionId: 'sz1', quantity: 2 }],
      shippingAddress: validAddress,
    })
    expect(r.success).toBe(true)
  })

  it('rejects empty cart', () => {
    const r = codOrderSchema.safeParse({ items: [], shippingAddress: validAddress })
    expect(r.success).toBe(false)
  })

  it('rejects non-positive / non-integer quantity', () => {
    expect(
      codOrderSchema.safeParse({
        items: [{ sizeOptionId: 'sz1', quantity: 0 }],
        shippingAddress: validAddress,
      }).success,
    ).toBe(false)
    expect(
      codOrderSchema.safeParse({
        items: [{ sizeOptionId: 'sz1', quantity: 1.5 }],
        shippingAddress: validAddress,
      }).success,
    ).toBe(false)
  })

  it('rejects bad country code length', () => {
    const r = codOrderSchema.safeParse({
      items: [{ sizeOptionId: 'sz1', quantity: 1 }],
      shippingAddress: { ...validAddress, country: 'PAK' },
    })
    expect(r.success).toBe(false)
  })

  it('rejects malformed coupon code', () => {
    const r = codOrderSchema.safeParse({
      items: [{ sizeOptionId: 'sz1', quantity: 1 }],
      shippingAddress: validAddress,
      couponCode: 'bad code!',
    })
    expect(r.success).toBe(false)
  })
})
