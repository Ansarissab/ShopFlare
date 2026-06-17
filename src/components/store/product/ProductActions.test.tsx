// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ProductActions } from './ProductActions'
import { en } from '@/lib/i18n/en'
import type { Product, SizeOption, Variant } from '@/lib/types/product'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const product = { id: 'p1', name: 'Hoodie' } as Product
const variant = { id: 'v1', label: 'Blue' } as Variant
const size = { id: 's1', size: 'M', priceCents: 2500 } as SizeOption

function defaults() {
  return {
    product,
    selectedVariant: variant,
    selectedSize: size as SizeOption | null,
    allSizesOOS: false,
    isAddingToCart: false,
    showWhatsApp: true,
    onAddToCart: vi.fn(),
    onBuyNow: vi.fn(),
    onWhatsApp: vi.fn(),
    onCOD: vi.fn(),
    onNotifyMe: vi.fn(),
  }
}

describe('ProductActions', () => {
  it('renders the notify-me button and fires onNotifyMe when all sizes are OOS', () => {
    const props = defaults()
    props.allSizesOOS = true
    render(<ProductActions {...props} />)
    const btn = screen.getByText(en.store.notifyMe)
    expect(btn).toBeTruthy()
    fireEvent.click(btn)
    expect(props.onNotifyMe).toHaveBeenCalledTimes(1)
    // Other buttons should not be present in OOS mode
    expect(screen.queryByText(en.store.addToCart)).toBeNull()
  })

  it('renders add-to-cart, buy-now and the contextual row when a size is selected', () => {
    const props = defaults()
    render(<ProductActions {...props} />)
    expect(screen.getByText(en.store.addToCart)).toBeTruthy()
    expect(screen.getByText(en.store.buyNow)).toBeTruthy()
    expect(screen.getByText(en.store.orderOnWhatsApp)).toBeTruthy()
    expect(screen.getByText(en.store.cashOnDelivery)).toBeTruthy()
  })

  it('hides the WhatsApp/COD row when no size is selected and disables primary actions', () => {
    const props = defaults()
    props.selectedSize = null
    render(<ProductActions {...props} />)
    expect(screen.queryByText(en.store.orderOnWhatsApp)).toBeNull()
    expect(screen.queryByText(en.store.cashOnDelivery)).toBeNull()
    expect(screen.getByText(en.store.addToCart).closest('button')!.disabled).toBe(true)
    expect(screen.getByText(en.store.buyNow).closest('button')!.disabled).toBe(true)
  })

  it('fires onAddToCart, onBuyNow, onWhatsApp and onCOD on their clicks', () => {
    const props = defaults()
    render(<ProductActions {...props} />)
    fireEvent.click(screen.getByText(en.store.addToCart))
    fireEvent.click(screen.getByText(en.store.buyNow))
    fireEvent.click(screen.getByText(en.store.orderOnWhatsApp))
    fireEvent.click(screen.getByText(en.store.cashOnDelivery))
    expect(props.onAddToCart).toHaveBeenCalledTimes(1)
    expect(props.onBuyNow).toHaveBeenCalledTimes(1)
    expect(props.onWhatsApp).toHaveBeenCalledTimes(1)
    expect(props.onCOD).toHaveBeenCalledTimes(1)
  })

  it('disables add-to-cart and shows the spinner while adding', () => {
    const props = defaults()
    props.isAddingToCart = true
    const { container } = render(<ProductActions {...props} />)
    expect(screen.getByText(en.store.addToCart).closest('button')!.disabled).toBe(true)
    expect(container.querySelector('.animate-spin')).toBeTruthy()
  })

  it('shows "Added" label and disables the button when isAdded is true', () => {
    const props = { ...defaults(), isAdded: true }
    render(<ProductActions {...props} />)
    expect(screen.getByText(en.store.addedToCart)).toBeTruthy()
    expect(screen.queryByText(en.store.addToCart)).toBeNull()
    expect(screen.getByText(en.store.addedToCart).closest('button')!.disabled).toBe(true)
  })

  it('renders the check icon (no spinner) in the added state', () => {
    const props = { ...defaults(), isAdded: true }
    const { container } = render(<ProductActions {...props} />)
    expect(container.querySelector('.animate-spin')).toBeNull()
    // lucide Check renders an svg; confirm no spinner present and button is disabled
    expect(screen.getByText(en.store.addedToCart).closest('button')!.disabled).toBe(true)
  })

  it('applies an extra className in both OOS and normal modes', () => {
    const props = defaults()
    const { container, rerender } = render(<ProductActions {...props} className="cls-a" />)
    expect((container.firstChild as HTMLElement).className).toContain('cls-a')
    rerender(<ProductActions {...props} allSizesOOS className="cls-b" />)
    expect((container.firstChild as HTMLElement).className).toContain('cls-b')
  })

  // ── WhatsApp flag gating ─────────────────────────────────────────────────────

  it('hides the WhatsApp button when showWhatsApp is false but still shows COD', () => {
    const props = { ...defaults(), showWhatsApp: false }
    render(<ProductActions {...props} />)
    expect(screen.queryByText(en.store.orderOnWhatsApp)).toBeNull()
    expect(screen.getByText(en.store.cashOnDelivery)).toBeTruthy()
  })

  it('shows the WhatsApp button when showWhatsApp is true and size is selected', () => {
    const props = { ...defaults(), showWhatsApp: true }
    render(<ProductActions {...props} />)
    expect(screen.getByText(en.store.orderOnWhatsApp)).toBeTruthy()
  })
})
