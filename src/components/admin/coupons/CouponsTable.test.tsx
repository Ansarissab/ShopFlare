// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { CouponsTable } from './CouponsTable'
import { en } from '@/lib/i18n/en'
import { formatDate } from '@/lib/utils/index'
import { apiDelete } from '@/lib/api'
import { toast } from 'sonner'
import type { AdminCoupon } from '@/lib/types/admin'

vi.mock('@/lib/api', () => ({
  apiDelete: vi.fn(() => Promise.resolve({})),
}))

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

function makeCoupon(overrides: Partial<AdminCoupon> = {}): AdminCoupon {
  return {
    id: 'cpn-1',
    code: 'SAVE20',
    type: 'percentage',
    value: 20,
    minOrderCents: null,
    maxDiscountCents: null,
    usageLimit: null,
    perCustomerLimit: 1,
    usedCount: 3,
    expiresAt: null,
    stripeCouponId: null,
    stripePromotionCodeId: null,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('CouponsTable', () => {
  it('renders empty state when there are no coupons', () => {
    render(<CouponsTable coupons={[]} onEdit={vi.fn()} onDeleted={vi.fn()} />)
    expect(screen.getByText(en.admin.noCoupons)).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('renders code, percentage value label, and percentage type', () => {
    render(<CouponsTable coupons={[makeCoupon()]} onEdit={vi.fn()} onDeleted={vi.fn()} />)
    expect(screen.getByText('SAVE20')).toBeTruthy()
    expect(screen.getByText('20%')).toBeTruthy()
    expect(screen.getByText(en.admin.couponTypePercentage)).toBeTruthy()
  })

  it('renders fixed value label with cents marker and fixed type', () => {
    render(
      <CouponsTable
        coupons={[makeCoupon({ type: 'fixed', value: 500 })]}
        onEdit={vi.fn()}
        onDeleted={vi.fn()}
      />,
    )
    expect(screen.getByText('500¢')).toBeTruthy()
    expect(screen.getByText(en.admin.couponTypeFixed)).toBeTruthy()
  })

  it('shows used count alone when usageLimit is null', () => {
    render(
      <CouponsTable coupons={[makeCoupon({ usedCount: 3, usageLimit: null })]} onEdit={vi.fn()} onDeleted={vi.fn()} />,
    )
    expect(screen.getByText('3')).toBeTruthy()
  })

  it('shows used / limit when usageLimit is set', () => {
    render(
      <CouponsTable coupons={[makeCoupon({ usedCount: 3, usageLimit: 10 })]} onEdit={vi.fn()} onDeleted={vi.fn()} />,
    )
    expect(screen.getByText('3 / 10')).toBeTruthy()
  })

  it('renders em dash when no expiry', () => {
    render(<CouponsTable coupons={[makeCoupon({ expiresAt: null })]} onEdit={vi.fn()} onDeleted={vi.fn()} />)
    // both the expiry cell and the (null) stripe cell render an em dash
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1)
  })

  it('renders the formatted date when an expiry is set', () => {
    render(
      <CouponsTable
        coupons={[makeCoupon({ expiresAt: '2026-12-31T00:00:00.000Z' })]}
        onEdit={vi.fn()}
        onDeleted={vi.fn()}
      />,
    )
    expect(screen.getByText(formatDate('2026-12-31T00:00:00.000Z'))).toBeTruthy()
  })

  it('renders active badge (active=true)', () => {
    render(<CouponsTable coupons={[makeCoupon({ active: true })]} onEdit={vi.fn()} onDeleted={vi.fn()} />)
    // 'Active' also appears as a column header, so the badge makes 2 matches
    expect(screen.getAllByText(en.admin.active).length).toBeGreaterThanOrEqual(2)
  })

  it('renders inactive badge (active=false)', () => {
    render(<CouponsTable coupons={[makeCoupon({ active: false })]} onEdit={vi.fn()} onDeleted={vi.fn()} />)
    expect(screen.getByText(en.admin.inactive)).toBeTruthy()
  })

  it('renders the stripe-synced badge when stripeCouponId is present', () => {
    render(
      <CouponsTable coupons={[makeCoupon({ stripeCouponId: 'co_123' })]} onEdit={vi.fn()} onDeleted={vi.fn()} />,
    )
    expect(screen.getByText(en.admin.syncStripeCoupon)).toBeTruthy()
  })

  it('does not render the stripe-synced badge when stripeCouponId is null', () => {
    render(
      <CouponsTable coupons={[makeCoupon({ stripeCouponId: null })]} onEdit={vi.fn()} onDeleted={vi.fn()} />,
    )
    expect(screen.queryByText(en.admin.syncStripeCoupon)).toBeNull()
  })

  it('calls onEdit with the coupon when the edit button is clicked', () => {
    const onEdit = vi.fn()
    const coupon = makeCoupon()
    render(<CouponsTable coupons={[coupon]} onEdit={onEdit} onDeleted={vi.fn()} />)
    fireEvent.click(screen.getByLabelText(en.admin.editCoupon))
    expect(onEdit).toHaveBeenCalledWith(coupon)
  })

  it('does nothing when delete confirm is cancelled', async () => {
    const onDeleted = vi.fn()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<CouponsTable coupons={[makeCoupon()]} onEdit={vi.fn()} onDeleted={onDeleted} />)
    fireEvent.click(screen.getByLabelText(en.admin.deleteCoupon))
    expect(apiDelete).not.toHaveBeenCalled()
    expect(onDeleted).not.toHaveBeenCalled()
  })

  it('deletes, toasts success, and calls onDeleted when confirmed', async () => {
    const onDeleted = vi.fn()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<CouponsTable coupons={[makeCoupon({ id: 'cpn-9' })]} onEdit={vi.fn()} onDeleted={onDeleted} />)
    fireEvent.click(screen.getByLabelText(en.admin.deleteCoupon))
    await waitFor(() => {
      expect(apiDelete).toHaveBeenCalledWith('/api/admin/coupons/cpn-9')
      expect(toast.success).toHaveBeenCalledWith(en.admin.couponDeleted)
      expect(onDeleted).toHaveBeenCalled()
    })
  })

  it('toasts a network error when delete fails', async () => {
    const onDeleted = vi.fn()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(apiDelete).mockRejectedValueOnce(new Error('boom'))
    render(<CouponsTable coupons={[makeCoupon()]} onEdit={vi.fn()} onDeleted={onDeleted} />)
    fireEvent.click(screen.getByLabelText(en.admin.deleteCoupon))
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(en.errors.networkError)
    })
    expect(onDeleted).not.toHaveBeenCalled()
  })

  it('renders one row per coupon', () => {
    render(
      <CouponsTable
        coupons={[makeCoupon({ id: 'a', code: 'AAA' }), makeCoupon({ id: 'b', code: 'BBB' })]}
        onEdit={vi.fn()}
        onDeleted={vi.fn()}
      />,
    )
    expect(screen.getByText('AAA')).toBeTruthy()
    expect(screen.getByText('BBB')).toBeTruthy()
  })
})
