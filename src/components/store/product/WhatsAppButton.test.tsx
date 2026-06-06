// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { WhatsAppButton } from './WhatsAppButton'
import { en } from '@/lib/i18n/en'
import type { WhatsAppButtonProps } from '@/lib/types/product'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const baseProps: WhatsAppButtonProps = {
  phoneNumber: '923001234567',
  productName: 'Blue Hoodie',
  variantLabel: 'Blue',
  size: 'M',
  sku: 'SKU-1',
  priceCents: 2500,
  currency: 'PKR',
}

describe('WhatsAppButton', () => {
  it('renders the WhatsApp order label', () => {
    render(<WhatsAppButton {...baseProps} />)
    expect(screen.getByText(en.store.orderOnWhatsApp)).toBeTruthy()
  })

  it('opens a wa.me url in a new tab when clicked', () => {
    const open = vi.fn()
    vi.stubGlobal('open', open)
    render(<WhatsAppButton {...baseProps} />)
    fireEvent.click(screen.getByText(en.store.orderOnWhatsApp))
    expect(open).toHaveBeenCalledTimes(1)
    const [url, target, features] = open.mock.calls[0]
    expect(url).toMatch(/^https:\/\/wa\.me\/923001234567\?text=/)
    expect(decodeURIComponent(url)).toContain('Blue Hoodie')
    expect(target).toBe('_blank')
    expect(features).toBe('noopener,noreferrer')
    vi.unstubAllGlobals()
  })

  it('passes quantity through to the built url (price reflects qty)', () => {
    const open = vi.fn()
    vi.stubGlobal('open', open)
    render(<WhatsAppButton {...baseProps} quantity={2} />)
    fireEvent.click(screen.getByText(en.store.orderOnWhatsApp))
    const url = decodeURIComponent(open.mock.calls[0][0])
    // 2500 * 2 = 5000 cents → ₨5,000 (PKR, 0 decimals)
    expect(url).toContain('₨5,000')
    expect(url).toContain(`${en.whatsapp.qty} 2`)
    vi.unstubAllGlobals()
  })

  it('does nothing and does not open a window when disabled', () => {
    const open = vi.fn()
    vi.stubGlobal('open', open)
    render(<WhatsAppButton {...baseProps} disabled />)
    const btn = screen.getByText(en.store.orderOnWhatsApp).closest('button')!
    expect(btn.disabled).toBe(true)
    // fire the click handler directly (disabled buttons swallow DOM clicks)
    fireEvent.click(btn)
    expect(open).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
