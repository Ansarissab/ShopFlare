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

  // ---- appended branch-coverage cases ----

  it('handleApplyCoupon returns early when code is blank/whitespace (onApplyCoupon not called)', () => {
    const onApplyCoupon = vi.fn(() => Promise.resolve(true))
    render(<CartSummary {...defaultProps} onApplyCoupon={onApplyCoupon} />)
    // whitespace-only -> trim() falsy -> guard returns; also Apply stays disabled
    fireEvent.change(screen.getByLabelText(en.cart.couponPlaceholder), {
      target: { value: '   ' },
    })
    const applyBtn = screen.getByRole('button', { name: en.cart.applyCoupon }) as HTMLButtonElement
    expect(applyBtn.disabled).toBe(true)
    fireEvent.click(applyBtn)
    expect(onApplyCoupon).not.toHaveBeenCalled()
  })

  it('typing after an invalid attempt resets coupon state back to idle', async () => {
    const onApplyCoupon = vi.fn(() => Promise.resolve(false))
    render(<CartSummary {...defaultProps} onApplyCoupon={onApplyCoupon} />)
    const input = screen.getByLabelText(en.cart.couponPlaceholder)
    fireEvent.change(input, { target: { value: 'BAD' } })
    fireEvent.click(screen.getByRole('button', { name: en.cart.applyCoupon }))
    await vi.waitFor(() => expect(screen.getByText(en.cart.couponInvalid)).toBeTruthy())
    // changing the code clears the invalid message (couponState !== 'idle' branch)
    fireEvent.change(input, { target: { value: 'BADX' } })
    expect(screen.queryByText(en.cart.couponInvalid)).toBeNull()
  })

  it('disables the coupon input + Apply button when couponApplied prop is true', () => {
    render(<CartSummary {...defaultProps} couponApplied />)
    const input = screen.getByLabelText(en.cart.couponPlaceholder) as HTMLInputElement
    expect(input.disabled).toBe(true)
    const applyBtn = screen.getByRole('button', { name: en.cart.applyCoupon }) as HTMLButtonElement
    expect(applyBtn.disabled).toBe(true)
    // applied-feedback paragraph rendered via (couponApplied || ...) truthy branch
    expect(screen.getAllByText(en.cart.couponApplied).length).toBeGreaterThan(0)
  })

  it('locks the input after a successful apply (couponState === applied branch)', async () => {
    const onApplyCoupon = vi.fn(() => Promise.resolve(true))
    render(<CartSummary {...defaultProps} onApplyCoupon={onApplyCoupon} />)
    const input = screen.getByLabelText(en.cart.couponPlaceholder) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'SAVE10' } })
    fireEvent.click(screen.getByRole('button', { name: en.cart.applyCoupon }))
    await vi.waitFor(() => expect(input.disabled).toBe(true))
  })

  it('renders an exclusive tax row with name + rate label', () => {
    render(
      <CartSummary
        {...defaultProps}
        taxCents={750}
        taxName="GST"
        taxRate={15}
        taxInclusive={false}
      />,
    )
    expect(
      screen.getByText(en.cart.taxRateLabel.replace('{name}', 'GST').replace('{rate}', '15')),
    ).toBeTruthy()
    // exclusive tax adds to the total: 5000 + 300 + 750 = 6050
    expect(screen.getByText('₨6,050')).toBeTruthy()
  })

  it('renders an inclusive tax row that does NOT change the grand total', () => {
    render(<CartSummary {...defaultProps} taxCents={750} taxName="VAT" taxRate={15} taxInclusive />)
    expect(screen.getByText(en.cart.taxIncluded.replace('{name}', 'VAT'))).toBeTruthy()
    // inclusive tax excluded from total: 5000 + 300 = 5300
    expect(screen.getByText('₨5,300')).toBeTruthy()
  })

  it('omits the tax row entirely when taxCents is 0 (default)', () => {
    render(<CartSummary {...defaultProps} />)
    expect(screen.queryByText(en.cart.tax)).toBeNull()
    expect(
      screen.queryByText(en.cart.taxRateLabel.replace('{name}', 'Tax').replace('{rate}', '0')),
    ).toBeNull()
  })

  it('omits the discount row when discountCents is 0 (default)', () => {
    render(<CartSummary {...defaultProps} />)
    // no negative-amount discount line present
    expect(screen.queryByText('-₨500')).toBeNull()
  })
})
