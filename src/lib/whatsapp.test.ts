import { describe, it, expect } from 'vitest'
import { buildWhatsAppOrderUrl } from '@/lib/whatsapp'
import type { WhatsAppOrderParams } from '@/lib/types/product'

const baseParams: WhatsAppOrderParams = {
  phoneNumber: '923001234567',
  productName: 'Classic Tee',
  variantLabel: 'Navy Blue',
  size: 'M',
  priceCents: 2500,
  currency: 'PKR',
  quantity: 1,
}

describe('buildWhatsAppOrderUrl', () => {
  it('returns a wa.me URL', () => {
    const url = buildWhatsAppOrderUrl(baseParams)
    expect(url).toMatch(/^https:\/\/wa\.me\//)
  })

  it('includes the phone number in the URL', () => {
    const url = buildWhatsAppOrderUrl(baseParams)
    expect(url).toContain('wa.me/923001234567')
  })

  it('includes a text query parameter', () => {
    const url = buildWhatsAppOrderUrl(baseParams)
    expect(url).toContain('?text=')
  })

  it('encodes the message (no raw newlines in URL)', () => {
    const url = buildWhatsAppOrderUrl(baseParams)
    // Raw newlines would be %0A in URL encoding
    expect(url).not.toMatch(/\n/)
  })

  it('includes the product name in the encoded message', () => {
    const url = buildWhatsAppOrderUrl(baseParams)
    const decoded = decodeURIComponent(url.split('?text=')[1])
    expect(decoded).toContain('Classic Tee')
  })

  it('includes the variant label in the message', () => {
    const url = buildWhatsAppOrderUrl(baseParams)
    const decoded = decodeURIComponent(url.split('?text=')[1])
    expect(decoded).toContain('Navy Blue')
  })

  it('includes the size in the message', () => {
    const url = buildWhatsAppOrderUrl(baseParams)
    const decoded = decodeURIComponent(url.split('?text=')[1])
    expect(decoded).toContain('M')
  })

  it('includes formatted price in the message', () => {
    const url = buildWhatsAppOrderUrl({ ...baseParams, priceCents: 2500, currency: 'PKR' })
    const decoded = decodeURIComponent(url.split('?text=')[1])
    // PKR is 0-decimal so 2500 cents = ₨2,500
    expect(decoded).toContain('2,500')
  })

  it('includes quantity in the message', () => {
    const url = buildWhatsAppOrderUrl({ ...baseParams, quantity: 3 })
    const decoded = decodeURIComponent(url.split('?text=')[1])
    expect(decoded).toContain('3')
  })

  it('includes SKU in the message when provided', () => {
    const url = buildWhatsAppOrderUrl({ ...baseParams, sku: 'TEE-NVY-M' })
    const decoded = decodeURIComponent(url.split('?text=')[1])
    expect(decoded).toContain('TEE-NVY-M')
  })

  it('omits SKU line when sku is not provided', () => {
    const url = buildWhatsAppOrderUrl(baseParams)
    const decoded = decodeURIComponent(url.split('?text=')[1])
    expect(decoded).not.toContain('SKU:')
  })

  it('multiplies priceCents by quantity for total price', () => {
    // 1000 PKR each × 2 = 2000 PKR displayed
    const url = buildWhatsAppOrderUrl({
      ...baseParams,
      priceCents: 1000,
      quantity: 2,
      currency: 'PKR',
    })
    const decoded = decodeURIComponent(url.split('?text=')[1])
    expect(decoded).toContain('2,000')
  })

  it('works with USD currency', () => {
    const url = buildWhatsAppOrderUrl({ ...baseParams, priceCents: 4999, currency: 'USD' })
    const decoded = decodeURIComponent(url.split('?text=')[1])
    // USD is 2-decimal so 4999 cents = $49.99
    expect(decoded).toContain('49.99')
  })

  it('different phone numbers produce different URLs', () => {
    const url1 = buildWhatsAppOrderUrl({ ...baseParams, phoneNumber: '923001234567' })
    const url2 = buildWhatsAppOrderUrl({ ...baseParams, phoneNumber: '447911123456' })
    expect(url1).not.toBe(url2)
    expect(url2).toContain('wa.me/447911123456')
  })
})
