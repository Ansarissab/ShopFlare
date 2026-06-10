// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { CouponForm } from './CouponForm'
import { en } from '@/lib/i18n/en'
import { apiPost, apiPut } from '@/lib/api'
import { toast } from 'sonner'
import type { AdminCoupon } from '@/lib/types/admin'

vi.mock('@/lib/api', () => ({
  apiPost: vi.fn(() => Promise.resolve({})),
  apiPut: vi.fn(() => Promise.resolve({})),
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
    minOrderCents: 1000,
    maxDiscountCents: 500,
    usageLimit: 100,
    perCustomerLimit: 2,
    usedCount: 0,
    expiresAt: '2026-12-31T12:00:00.000Z',
    stripeCouponId: null,
    stripePromotionCodeId: null,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

// FormField labels embed a HelpTip whose aria-label collides with getByLabelText,
// so query the inputs by their stable id instead.
const byId = (id: string) => document.getElementById(id) as HTMLInputElement
const codeInput = () => byId('coupon-code')
const valueInput = () => byId('coupon-value')

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('CouponForm — create mode', () => {
  it('renders the add-coupon heading and enabled code field', () => {
    render(<CouponForm onSaved={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByRole('heading', { name: en.admin.addCoupon })).toBeTruthy()
    expect(codeInput().disabled).toBe(false)
  })

  it('uppercases the code as the user types', () => {
    render(<CouponForm onSaved={vi.fn()} onCancel={vi.fn()} />)
    fireEvent.change(codeInput(), { target: { value: 'save10' } })
    expect(codeInput().value).toBe('SAVE10')
  })

  it('blocks submit and toasts when code is empty', () => {
    render(<CouponForm onSaved={vi.fn()} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: en.admin.save }))
    expect(toast.error).toHaveBeenCalledWith(
      en.errors.required.replace('{field}', en.admin.couponCode),
    )
    expect(apiPost).not.toHaveBeenCalled()
  })

  it('blocks submit and toasts when value is missing or non-positive', () => {
    render(<CouponForm onSaved={vi.fn()} onCancel={vi.fn()} />)
    fireEvent.change(codeInput(), { target: { value: 'SAVE10' } })
    // value defaults to '' -> fails the value guard
    fireEvent.click(screen.getByRole('button', { name: en.admin.save }))
    expect(toast.error).toHaveBeenCalledWith(
      en.errors.required.replace('{field}', en.admin.couponValue),
    )
    expect(apiPost).not.toHaveBeenCalled()
  })

  it('posts a minimal payload, toasts success, and calls onSaved', async () => {
    const onSaved = vi.fn()
    render(<CouponForm onSaved={onSaved} onCancel={vi.fn()} />)
    fireEvent.change(codeInput(), { target: { value: 'save10' } })
    fireEvent.change(valueInput(), { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: en.admin.save }))

    await waitFor(() => expect(apiPost).toHaveBeenCalled())
    const [url, payload] = vi.mocked(apiPost).mock.calls[0]
    expect(url).toBe('/api/admin/coupons')
    expect(payload).toMatchObject({
      code: 'SAVE10',
      type: 'percentage',
      value: 10,
      perCustomerLimit: 1,
      active: true,
    })
    // optional fields omitted when empty
    expect(payload).not.toHaveProperty('minOrderCents')
    expect(payload).not.toHaveProperty('maxDiscountCents')
    expect(payload).not.toHaveProperty('usageLimit')
    expect(payload).not.toHaveProperty('expiresAt')
    expect(toast.success).toHaveBeenCalledWith(en.admin.couponCreated)
    expect(onSaved).toHaveBeenCalled()
  })

  it('includes all optional numeric + expiry fields when filled', async () => {
    render(<CouponForm onSaved={vi.fn()} onCancel={vi.fn()} />)
    fireEvent.change(codeInput(), { target: { value: 'BIG' } })
    fireEvent.change(valueInput(), { target: { value: '15' } })
    fireEvent.change(byId('coupon-min-order'), { target: { value: '2000' } })
    fireEvent.change(byId('coupon-max-discount'), { target: { value: '800' } })
    fireEvent.change(byId('coupon-usage-limit'), { target: { value: '50' } })
    fireEvent.change(byId('coupon-per-customer'), { target: { value: '3' } })
    fireEvent.change(byId('coupon-expires'), { target: { value: '2026-12-31T12:00' } })
    fireEvent.click(screen.getByRole('button', { name: en.admin.save }))

    await waitFor(() => expect(apiPost).toHaveBeenCalled())
    const payload = vi.mocked(apiPost).mock.calls[0][1] as Record<string, unknown>
    expect(payload.minOrderCents).toBe(2000)
    expect(payload.maxDiscountCents).toBe(800)
    expect(payload.usageLimit).toBe(50)
    expect(payload.perCustomerLimit).toBe(3)
    expect(typeof payload.expiresAt).toBe('string')
    expect(new Date(payload.expiresAt as string).toISOString()).toBe(
      new Date('2026-12-31T12:00').toISOString(),
    )
  })

  it('defaults perCustomerLimit to 1 when blanked', async () => {
    render(<CouponForm onSaved={vi.fn()} onCancel={vi.fn()} />)
    fireEvent.change(codeInput(), { target: { value: 'X' } })
    fireEvent.change(valueInput(), { target: { value: '5' } })
    fireEvent.change(byId('coupon-per-customer'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: en.admin.save }))
    await waitFor(() => expect(apiPost).toHaveBeenCalled())
    const payload = vi.mocked(apiPost).mock.calls[0][1] as Record<string, unknown>
    expect(payload.perCustomerLimit).toBe(1)
  })

  it('toasts the error message when apiPost rejects with an Error', async () => {
    vi.mocked(apiPost).mockRejectedValueOnce(new Error('duplicate code'))
    render(<CouponForm onSaved={vi.fn()} onCancel={vi.fn()} />)
    fireEvent.change(codeInput(), { target: { value: 'X' } })
    fireEvent.change(valueInput(), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: en.admin.save }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('duplicate code'))
  })

  it('toasts a generic network error when apiPost rejects with a non-Error', async () => {
    vi.mocked(apiPost).mockRejectedValueOnce('weird')
    render(<CouponForm onSaved={vi.fn()} onCancel={vi.fn()} />)
    fireEvent.change(codeInput(), { target: { value: 'X' } })
    fireEvent.change(valueInput(), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: en.admin.save }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(en.errors.networkError))
  })

  it('cancel button invokes onCancel', () => {
    const onCancel = vi.fn()
    render(<CouponForm onSaved={vi.fn()} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: en.admin.cancel }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('toggling active off sends active:false in the payload', async () => {
    render(<CouponForm onSaved={vi.fn()} onCancel={vi.fn()} />)
    fireEvent.change(codeInput(), { target: { value: 'X' } })
    fireEvent.change(valueInput(), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: en.admin.save }))
    await waitFor(() => expect(apiPost).toHaveBeenCalled())
    const payload = vi.mocked(apiPost).mock.calls[0][1] as Record<string, unknown>
    expect(payload.active).toBe(false)
  })
})

describe('CouponForm — edit mode', () => {
  it('renders edit heading, prefills values, and locks code/value', () => {
    render(<CouponForm coupon={makeCoupon()} onSaved={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByRole('heading', { name: en.admin.editCoupon })).toBeTruthy()
    expect(codeInput().value).toBe('SAVE20')
    expect(codeInput().disabled).toBe(true)
    expect(valueInput().value).toBe('20')
    expect(valueInput().disabled).toBe(true)
  })

  it('prefills the expiry as a local datetime-local value', () => {
    render(<CouponForm coupon={makeCoupon()} onSaved={vi.fn()} onCancel={vi.fn()} />)
    // 16-char datetime-local string (YYYY-MM-DDTHH:mm)
    expect(byId('coupon-expires').value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  })

  it('treats an invalid stored expiry as empty', () => {
    render(
      <CouponForm
        coupon={makeCoupon({ expiresAt: 'not-a-date' })}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(byId('coupon-expires').value).toBe('')
  })

  it('puts to the coupon id, toasts updated, and calls onSaved', async () => {
    const onSaved = vi.fn()
    render(
      <CouponForm coupon={makeCoupon({ id: 'cpn-42' })} onSaved={onSaved} onCancel={vi.fn()} />,
    )
    fireEvent.click(screen.getByRole('button', { name: en.admin.save }))
    await waitFor(() => expect(apiPut).toHaveBeenCalled())
    expect(vi.mocked(apiPut).mock.calls[0][0]).toBe('/api/admin/coupons/cpn-42')
    expect(toast.success).toHaveBeenCalledWith(en.admin.couponUpdated)
    expect(onSaved).toHaveBeenCalled()
    expect(apiPost).not.toHaveBeenCalled()
  })
})
