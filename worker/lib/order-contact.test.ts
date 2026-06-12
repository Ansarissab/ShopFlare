import { describe, it, expect } from 'vitest'
import { contactMatchesOrder, MIN_CONTACT_PHONE_DIGITS } from 'worker/lib/order-contact'

const order = { customerEmail: 'jane@example.com', customerPhone: '+92 300 1234567' }

describe('contactMatchesOrder', () => {
  it('matches on exact email (case-insensitive, trimmed)', () => {
    expect(contactMatchesOrder(order, '  JANE@example.com ')).toBe(true)
  })

  it('matches on the full phone number (ignoring formatting)', () => {
    expect(contactMatchesOrder(order, '+923001234567')).toBe(true)
    expect(contactMatchesOrder(order, '300-1234567')).toBe(true)
  })

  it('matches a phone suffix at/above the minimum digit length', () => {
    // last 7 digits of the stored number
    expect(contactMatchesOrder(order, '1234567')).toBe(true)
  })

  // Regression: a short suffix must NOT match — otherwise order lookup/cancel
  // becomes an enumeration/PII oracle (SEC-1).
  it('rejects a short phone suffix below the minimum', () => {
    expect(contactMatchesOrder(order, '7')).toBe(false)
    expect(contactMatchesOrder(order, '567')).toBe(false)
    expect('567'.length).toBeLessThan(MIN_CONTACT_PHONE_DIGITS)
  })

  it('rejects a non-matching email or phone', () => {
    expect(contactMatchesOrder(order, 'wrong@example.com')).toBe(false)
    expect(contactMatchesOrder(order, '9999999')).toBe(false)
  })

  it('rejects when the order has no email/phone on file', () => {
    expect(contactMatchesOrder({ customerEmail: null, customerPhone: null }, '1234567')).toBe(false)
  })
})
