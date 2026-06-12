// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { OrderSummary } from './OrderSummary'
import { en } from '@/lib/i18n/en'
import { formatPrice } from '@/lib/utils/index'

interface CartState {
  items: Array<Record<string, unknown>>
  discountCents: number
}

let cartState: CartState = { items: [], discountCents: 0 }
let subtotal = 0
let mockConfig: Record<string, unknown> | null = null

vi.mock('next/image', async () => {
  const { createElement } = await import('react')
  return {
    default: (props: Record<string, unknown>) => {
      const { fill, priority, ...rest } = props
      return createElement('img', rest)
    },
  }
})

vi.mock('@/hooks/useCart', () => ({
  useCart: (selector: (s: CartState) => unknown) => selector(cartState),
  useCartSubtotalCents: () => subtotal,
}))

vi.mock('@/hooks/useStoreConfig', () => ({
  useStoreConfig: () => ({ config: mockConfig }),
}))

const item = {
  sizeOptionId: 'sz-1',
  imageUrl: '/img.jpg',
  productName: 'Red Cap',
  variantLabel: 'Red',
  size: 'L',
  quantity: 2,
  priceCents: 1500,
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  cartState = { items: [], discountCents: 0 }
  subtotal = 0
  mockConfig = null
})

describe('OrderSummary', () => {
  it('renders cart line items', () => {
    cartState = { items: [item], discountCents: 0 }
    subtotal = 3000
    render(<OrderSummary />)
    expect(screen.getByText('Red Cap')).toBeTruthy()
  })

  it('renders subtotal and shipping rows; free shipping when threshold met', () => {
    cartState = { items: [item], discountCents: 0 }
    subtotal = 50000
    // threshold 10000, subtotal 50000 >= threshold → free shipping
    mockConfig = { flatShippingRateCents: 29900, freeShippingThresholdCents: 10000 }
    render(<OrderSummary />)
    expect(screen.getByText(en.cart.subtotal)).toBeTruthy()
    expect(screen.getByText(en.cart.shipping)).toBeTruthy()
    expect(screen.getByText(en.cart.shippingFree)).toBeTruthy()
  })

  it('charges flat shipping when below the free threshold', () => {
    cartState = { items: [item], discountCents: 0 }
    subtotal = 3000
    mockConfig = {
      flatShippingRateCents: 29900,
      freeShippingThresholdCents: 1000000,
    }
    render(<OrderSummary />)
    expect(screen.getByText(formatPrice(29900))).toBeTruthy()
  })

  it('falls back to 0 shipping when config absent (matches CartSheet + DB default)', () => {
    cartState = { items: [item], discountCents: 0 }
    subtotal = 3000
    mockConfig = null // defaults: flatRate 0, threshold 0 → free shipping shown
    render(<OrderSummary />)
    expect(screen.getByText(en.cart.shippingFree)).toBeTruthy()
  })

  it('renders tax row when tax enabled and tax > 0 (exclusive)', () => {
    cartState = { items: [item], discountCents: 0 }
    subtotal = 10000
    mockConfig = {
      flatShippingRateCents: 0,
      freeShippingThresholdCents: 1000000,
      taxEnabled: true,
      taxRate: 10,
      taxName: 'GST',
      taxInclusive: false,
      taxBasis: 'subtotal',
    }
    render(<OrderSummary />)
    const label = en.cart.taxRateLabel.replace('{name}', 'GST').replace('{rate}', '10')
    expect(screen.getByText(label)).toBeTruthy()
  })

  it('renders inclusive tax label when taxInclusive true', () => {
    cartState = { items: [item], discountCents: 0 }
    subtotal = 10000
    mockConfig = {
      flatShippingRateCents: 0,
      freeShippingThresholdCents: 1000000,
      taxEnabled: true,
      taxRate: 10,
      taxName: 'VAT',
      taxInclusive: true,
      taxBasis: 'subtotal',
    }
    render(<OrderSummary />)
    expect(screen.getByText(en.cart.taxIncluded.replace('{name}', 'VAT'))).toBeTruthy()
  })

  it('does not render tax row when tax disabled', () => {
    cartState = { items: [item], discountCents: 0 }
    subtotal = 10000
    mockConfig = { taxEnabled: false }
    render(<OrderSummary />)
    expect(screen.queryByText(/GST|VAT|Tax \(/)).toBeNull()
  })

  it('renders discount row when discountCents > 0', () => {
    cartState = { items: [item], discountCents: 500 }
    subtotal = 10000
    mockConfig = { freeShippingThresholdCents: 0 }
    render(<OrderSummary />)
    expect(screen.getByText(en.cart.couponApplied)).toBeTruthy()
    expect(screen.getByText(`-${formatPrice(500)}`)).toBeTruthy()
  })

  it('omits discount row when no discount', () => {
    cartState = { items: [item], discountCents: 0 }
    subtotal = 10000
    render(<OrderSummary />)
    expect(screen.queryByText(en.cart.couponApplied)).toBeNull()
  })

  it('always renders the total row', () => {
    cartState = { items: [item], discountCents: 0 }
    subtotal = 10000
    render(<OrderSummary />)
    expect(screen.getByText(en.cart.total)).toBeTruthy()
  })
})
