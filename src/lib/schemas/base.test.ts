import { describe, it, expect } from 'vitest'
import {
  idField,
  quantityField,
  emailField,
  phoneField,
  couponField,
  baseItemSchema,
  orderItemSchema,
  contactSchema,
  hexColorField,
} from '@/lib/schemas/base'

describe('idField', () => {
  it('accepts non-empty string', () => {
    expect(idField.safeParse('abc123').success).toBe(true)
  })

  it('rejects empty string', () => {
    expect(idField.safeParse('').success).toBe(false)
  })
})

describe('quantityField', () => {
  it('accepts positive integer', () => {
    expect(quantityField.safeParse(1).success).toBe(true)
    expect(quantityField.safeParse(999).success).toBe(true)
  })

  it('rejects zero', () => {
    expect(quantityField.safeParse(0).success).toBe(false)
  })

  it('rejects float', () => {
    expect(quantityField.safeParse(1.5).success).toBe(false)
  })

  it('rejects value over 999', () => {
    expect(quantityField.safeParse(1000).success).toBe(false)
  })
})

describe('emailField', () => {
  it('accepts valid email', () => {
    expect(emailField.safeParse('user@example.com').success).toBe(true)
  })

  it('rejects invalid email', () => {
    expect(emailField.safeParse('notanemail').success).toBe(false)
    expect(emailField.safeParse('@domain.com').success).toBe(false)
  })
})

describe('phoneField', () => {
  it('accepts international E.164 format', () => {
    expect(phoneField.safeParse('+923001234567').success).toBe(true)
    expect(phoneField.safeParse('+12025551234').success).toBe(true)
  })

  it('accepts number without leading +', () => {
    expect(phoneField.safeParse('923001234567').success).toBe(true)
  })

  it('rejects too short phone (under 7 digits)', () => {
    expect(phoneField.safeParse('+12345').success).toBe(false)
  })

  it('rejects number starting with 0', () => {
    expect(phoneField.safeParse('01234567890').success).toBe(false)
  })
})

describe('couponField', () => {
  it('accepts valid coupon code', () => {
    expect(couponField.safeParse('SAVE10').success).toBe(true)
    expect(couponField.safeParse('BLACK-FRIDAY').success).toBe(true)
    expect(couponField.safeParse('PROMO_2024').success).toBe(true)
  })

  it('accepts undefined (optional)', () => {
    expect(couponField.safeParse(undefined).success).toBe(true)
  })

  it('rejects code with spaces or special chars', () => {
    expect(couponField.safeParse('bad code!').success).toBe(false)
    expect(couponField.safeParse('PROMO@2024').success).toBe(false)
  })

  it('rejects code shorter than MIN_COUPON_CODE_LENGTH (6)', () => {
    expect(couponField.safeParse('SAVE').success).toBe(false)
  })

  it('rejects code longer than MAX_COUPON_CODE_LENGTH (20)', () => {
    expect(couponField.safeParse('A'.repeat(21)).success).toBe(false)
  })
})

describe('baseItemSchema', () => {
  it('accepts valid quantity', () => {
    expect(baseItemSchema.safeParse({ quantity: 3 }).success).toBe(true)
  })

  it('rejects missing quantity', () => {
    expect(baseItemSchema.safeParse({}).success).toBe(false)
  })
})

describe('orderItemSchema', () => {
  it('accepts sizeOptionId + quantity', () => {
    const r = orderItemSchema.safeParse({ sizeOptionId: 'sz1', quantity: 2 })
    expect(r.success).toBe(true)
  })

  it('rejects missing sizeOptionId', () => {
    expect(orderItemSchema.safeParse({ quantity: 2 }).success).toBe(false)
  })
})

describe('contactSchema', () => {
  it('accepts empty object (both optional)', () => {
    expect(contactSchema.safeParse({}).success).toBe(true)
  })

  it('accepts email only', () => {
    expect(contactSchema.safeParse({ email: 'a@b.com' }).success).toBe(true)
  })

  it('accepts phone only', () => {
    expect(contactSchema.safeParse({ phone: '+12025551234' }).success).toBe(true)
  })

  it('rejects invalid email when provided', () => {
    expect(contactSchema.safeParse({ email: 'bad' }).success).toBe(false)
  })
})

describe('hexColorField', () => {
  it('accepts valid 6-digit hex', () => {
    expect(hexColorField.safeParse('#1a2b3c').success).toBe(true)
    expect(hexColorField.safeParse('#FFFFFF').success).toBe(true)
    expect(hexColorField.safeParse('#000000').success).toBe(true)
  })

  it('rejects hex without hash', () => {
    expect(hexColorField.safeParse('1a2b3c').success).toBe(false)
  })

  it('rejects 3-digit shorthand', () => {
    expect(hexColorField.safeParse('#fff').success).toBe(false)
  })

  it('rejects non-hex characters', () => {
    expect(hexColorField.safeParse('#gggggg').success).toBe(false)
  })
})
