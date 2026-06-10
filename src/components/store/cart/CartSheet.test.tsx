// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { CartSheet } from './CartSheet'
import { en } from '@/lib/i18n/en'

// ─── Mocks ─────────────────────────────────────────────────────────────────────

// next/link → plain anchor
vi.mock('next/link', async () => {
  const { createElement } = await import('react')
  return {
    default: ({
      href,
      children,
      onClick,
    }: {
      href: string
      children: React.ReactNode
      onClick?: () => void
    }) => createElement('a', { href, onClick }, children),
  }
})

// sonner toast
const toastError = vi.fn()
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: (...a: unknown[]) => toastError(...a) }),
}))

// lib/api — apiPost is what CartSheet.handleApplyCoupon calls. Keep real ApiError.
const apiPost = vi.fn()
vi.mock('@/lib/api', async () => {
  // Mirror the real ApiError signature: (status, message).
  class ApiError extends Error {
    constructor(
      public readonly status: number,
      message: string,
    ) {
      super(message)
      this.name = 'ApiError'
    }
  }
  return {
    apiPost: (...a: unknown[]) => apiPost(...a),
    ApiError,
  }
})

// Shipping/tax helpers — deterministic
vi.mock('@/lib/utils/index', () => ({
  calculateShipping: (subtotal: number, flat: number, threshold: number) =>
    threshold > 0 && subtotal >= threshold ? 0 : flat,
  calculateTax: ({ subtotalCents, taxRate }: { subtotalCents: number; taxRate: number }) =>
    Math.round((subtotalCents * taxRate) / 100),
}))

// useStoreConfig — controllable per-test
let mockConfig: Record<string, unknown> | undefined = {
  taxEnabled: false,
  taxRate: 0,
  taxName: 'Tax',
  taxInclusive: false,
  taxBasis: 'subtotal',
}
vi.mock('@/hooks/useStoreConfig', () => ({
  useStoreConfig: () => ({ config: mockConfig }),
}))

// useCart — supports BOTH useCart() (returns full state object) and the
// selector form useCart((s) => ...). useCartSubtotalCents is separate.
interface MockCartState {
  items: Array<Record<string, unknown>>
  isOpen: boolean
  closeCart: () => void
  discountCents: number
  couponCode: string | null
  applyCoupon: (code: string, cents: number) => void
}
const closeCart = vi.fn()
const applyCoupon = vi.fn()
let cartState: MockCartState
function resetCart() {
  cartState = {
    items: [],
    isOpen: true,
    closeCart,
    discountCents: 0,
    couponCode: null,
    applyCoupon,
  }
}
resetCart()
let subtotalCents = 0
vi.mock('@/hooks/useCart', () => ({
  useCart: (selector?: (s: MockCartState) => unknown) =>
    typeof selector === 'function' ? selector(cartState) : cartState,
  useCartSubtotalCents: () => subtotalCents,
}))

// Child components — mock so we can probe what CartSheet passes / exercise its handler.
vi.mock('@/components/store/cart/CartItem', async () => {
  const { createElement } = await import('react')
  return {
    CartItem: ({ item }: { item: { sizeOptionId: string; productName: string } }) =>
      createElement('div', { 'data-testid': 'cart-item' }, item.productName),
  }
})

vi.mock('@/components/store/cart/FreeShippingBar', async () => {
  const { createElement } = await import('react')
  return {
    FreeShippingBar: (props: Record<string, unknown>) =>
      createElement('div', { 'data-testid': 'free-shipping-bar' }, JSON.stringify(props)),
  }
})

// CartSummary mock exposes buttons that call onApplyCoupon / onClose so we can
// drive CartSheet.handleApplyCoupon and closeCart without the real UI.
vi.mock('@/components/store/cart/CartSummary', async () => {
  const { createElement } = await import('react')
  return {
    CartSummary: (props: {
      onApplyCoupon: (code: string) => Promise<boolean>
      onClose: () => void
      taxCents: number
      taxName: string
      couponApplied: boolean
      discountCents: number
    }) =>
      createElement(
        'div',
        { 'data-testid': 'cart-summary' },
        createElement('span', { 'data-testid': 'tax-cents' }, String(props.taxCents)),
        createElement('span', { 'data-testid': 'tax-name' }, props.taxName),
        createElement('span', { 'data-testid': 'coupon-applied' }, String(props.couponApplied)),
        createElement('span', { 'data-testid': 'discount-cents' }, String(props.discountCents)),
        createElement(
          'button',
          { 'data-testid': 'apply', onClick: () => props.onApplyCoupon('SAVE10') },
          'apply',
        ),
        createElement('button', { 'data-testid': 'close', onClick: props.onClose }, 'close'),
      ),
  }
})

beforeEach(() => {
  resetCart()
  subtotalCents = 0
  mockConfig = {
    taxEnabled: false,
    taxRate: 0,
    taxName: 'Tax',
    taxInclusive: false,
    taxBasis: 'subtotal',
  }
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('CartSheet — empty state', () => {
  it('renders title and empty message with continue-shopping link when no items', () => {
    render(<CartSheet />)
    expect(screen.getByText(en.cart.title)).toBeTruthy()
    expect(screen.getByText(en.cart.empty)).toBeTruthy()
    const link = screen.getByText(en.store.continueShopping)
    expect(link.getAttribute('href')).toBe('/')
  })

  it('continue-shopping link click calls closeCart', () => {
    render(<CartSheet />)
    fireEvent.click(screen.getByText(en.store.continueShopping))
    expect(closeCart).toHaveBeenCalled()
  })

  it('does NOT render item list / summary when empty', () => {
    render(<CartSheet />)
    expect(screen.queryByTestId('cart-summary')).toBeNull()
    expect(screen.queryByTestId('free-shipping-bar')).toBeNull()
  })
})

describe('CartSheet — populated state', () => {
  beforeEach(() => {
    cartState.items = [
      { sizeOptionId: 's1', productName: 'Hoodie' },
      { sizeOptionId: 's2', productName: 'Cap' },
    ]
    subtotalCents = 5000
  })

  it('renders one CartItem per item and the summary + free-shipping bar', () => {
    render(<CartSheet />)
    expect(screen.getAllByTestId('cart-item')).toHaveLength(2)
    expect(screen.getByTestId('free-shipping-bar')).toBeTruthy()
    expect(screen.getByTestId('cart-summary')).toBeTruthy()
  })

  it('passes taxCents = 0 when tax disabled', () => {
    render(<CartSheet />)
    expect(screen.getByTestId('tax-cents').textContent).toBe('0')
  })

  it('computes taxCents via calculateTax when tax enabled', () => {
    mockConfig = {
      taxEnabled: true,
      taxRate: 10,
      taxName: 'VAT',
      taxInclusive: false,
      taxBasis: 'subtotal',
    }
    render(<CartSheet />)
    // 10% of 5000 = 500
    expect(screen.getByTestId('tax-cents').textContent).toBe('500')
    expect(screen.getByTestId('tax-name').textContent).toBe('VAT')
  })

  it('falls back to defaults when config is undefined (taxCents 0, default Tax name)', () => {
    mockConfig = undefined
    render(<CartSheet />)
    expect(screen.getByTestId('tax-cents').textContent).toBe('0')
    expect(screen.getByTestId('tax-name').textContent).toBe('Tax')
  })

  it('reflects couponApplied + discountCents from store selectors', () => {
    cartState.couponCode = 'SAVE10'
    cartState.discountCents = 750
    render(<CartSheet />)
    expect(screen.getByTestId('coupon-applied').textContent).toBe('true')
    expect(screen.getByTestId('discount-cents').textContent).toBe('750')
  })

  it('close button from summary calls closeCart', () => {
    render(<CartSheet />)
    fireEvent.click(screen.getByTestId('close'))
    expect(closeCart).toHaveBeenCalled()
  })
})

describe('CartSheet — handleApplyCoupon', () => {
  beforeEach(() => {
    cartState.items = [{ sizeOptionId: 's1', productName: 'Hoodie' }]
    subtotalCents = 5000
  })

  it('valid coupon → applyCoupon called with code + discountCents, no toast', async () => {
    apiPost.mockResolvedValueOnce({ valid: true, discountCents: 600 })
    render(<CartSheet />)
    fireEvent.click(screen.getByTestId('apply'))
    await waitFor(() => expect(applyCoupon).toHaveBeenCalledWith('SAVE10', 600))
    expect(apiPost).toHaveBeenCalledWith('/api/coupons/validate', {
      code: 'SAVE10',
      subtotalCents: 5000,
    })
    expect(toastError).not.toHaveBeenCalled()
  })

  it('invalid coupon with message → toast.error(message)', async () => {
    apiPost.mockResolvedValueOnce({ valid: false, discountCents: 0, message: 'Expired code' })
    render(<CartSheet />)
    fireEvent.click(screen.getByTestId('apply'))
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Expired code'))
    expect(applyCoupon).not.toHaveBeenCalled()
  })

  it('invalid coupon without message → toast.error(default invalid text)', async () => {
    apiPost.mockResolvedValueOnce({ valid: false, discountCents: 0 })
    render(<CartSheet />)
    fireEvent.click(screen.getByTestId('apply'))
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(en.cart.couponInvalid))
  })

  it('ApiError thrown → toast.error(error.message)', async () => {
    const { ApiError } = await import('@/lib/api')
    apiPost.mockRejectedValueOnce(new ApiError(500, 'Server boom'))
    render(<CartSheet />)
    fireEvent.click(screen.getByTestId('apply'))
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Server boom'))
  })

  it('non-ApiError thrown → toast.error(default invalid text)', async () => {
    apiPost.mockRejectedValueOnce(new Error('network'))
    render(<CartSheet />)
    fireEvent.click(screen.getByTestId('apply'))
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(en.cart.couponInvalid))
  })
})
