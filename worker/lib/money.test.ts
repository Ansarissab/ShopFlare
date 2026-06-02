import { describe, it, expect } from 'vitest'
import { formatCents } from 'worker/lib/money'

describe('formatCents', () => {
  it('formats 0-decimal currencies (PKR) as whole units', () => {
    expect(formatCents(2500, 'PKR')).toBe('₨2,500')
    expect(formatCents(0, 'PKR')).toBe('₨0')
  })

  it('formats 2-decimal currencies (USD) from minor units', () => {
    expect(formatCents(4999, 'USD')).toBe('$49.99')
    expect(formatCents(100, 'USD')).toBe('$1.00')
  })

  it('groups thousands', () => {
    expect(formatCents(1234567, 'USD')).toBe('$12,345.67')
  })
})
