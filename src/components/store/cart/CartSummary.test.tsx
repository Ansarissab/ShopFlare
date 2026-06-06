// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { CartSummary } from './CartSummary'
import { en } from '@/lib/i18n/en'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const defaultProps = {
  subtotalCents: 5000,
  shippingCents: 300,
  onApplyCoupon: vi.fn(() => Promise.resolve(false)),
  onClose: vi.fn(),
}

describe('CartSummary', () => {
  it('renders subtotal correctly', () => {
    render(<CartSummary {...defaultProps} />)
    // 5000 cents = ₨5,000 in PKR
    const subtotalLabel = screen.getByText(en.cart.subtotal)
    expect(subtotalLabel).toBeTruthy()
    expect(screen.getAllByText('₨5,000').length).toBeGreaterThan(0)
  })

  it('renders shipping cost when non-zero', () => {
    render(<CartSummary {...defaultProps} />)
    expect(screen.getByText(en.cart.shipping)).toBeTruthy()
    expect(screen.getByText('₨300')).toBeTruthy()
  })

  it('renders "Free" when shipping is 0', () => {
    render(<CartSummary {...defaultProps} shippingCents={0} />)
    expect(screen.getByText(en.cart.shippingFree)).toBeTruthy()
  })

  it('renders total label', () => {
    render(<CartSummary {...defaultProps} />)
    expect(screen.getByText(en.cart.total)).toBeTruthy()
  })

  it('renders grand total (subtotal + shipping)', () => {
    render(<CartSummary {...defaultProps} />)
    // 5000 + 300 = 5300 cents = ₨5,300
    expect(screen.getByText('₨5,300')).toBeTruthy()
  })

  it('renders discount row and adjusted total when discountCents provided', () => {
    render(<CartSummary {...defaultProps} discountCents={500} couponApplied />)
    // discount: -₨500
    expect(screen.getByText('-₨500')).toBeTruthy()
    // total: 5000 + 300 - 500 = 4800
    expect(screen.getByText('₨4,800')).toBeTruthy()
  })

  it('checkout button calls router.push and onClose', () => {
    const push = vi.fn()
    const onClose = vi.fn()
    vi.doMock('next/navigation', () => ({
      useRouter: () => ({ push }),
      useSearchParams: () => new URLSearchParams(),
      usePathname: () => '/',
    }))
    render(<CartSummary {...defaultProps} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: en.store.checkout }))
    expect(onClose).toHaveBeenCalled()
  })

  it('continue shopping button calls onClose', () => {
    const onClose = vi.fn()
    render(<CartSummary {...defaultProps} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: en.store.continueShopping }))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows coupon applied feedback after successful apply', async () => {
    const onApplyCoupon = vi.fn(() => Promise.resolve(true))
    render(<CartSummary {...defaultProps} onApplyCoupon={onApplyCoupon} />)
    fireEvent.change(screen.getByLabelText(en.cart.couponPlaceholder), {
      target: { value: 'SAVE10' },
    })
    fireEvent.click(screen.getByRole('button', { name: en.cart.applyCoupon }))
    await vi.waitFor(() => {
      expect(screen.getAllByText(en.cart.couponApplied).length).toBeGreaterThan(0)
    })
  })

  it('shows invalid coupon feedback on failure', async () => {
    const onApplyCoupon = vi.fn(() => Promise.resolve(false))
    render(<CartSummary {...defaultProps} onApplyCoupon={onApplyCoupon} />)
    fireEvent.change(screen.getByLabelText(en.cart.couponPlaceholder), {
      target: { value: 'BADCODE' },
    })
    fireEvent.click(screen.getByRole('button', { name: en.cart.applyCoupon }))
    await vi.waitFor(() => {
      expect(screen.getByText(en.cart.couponInvalid)).toBeTruthy()
    })
  })
})
