// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { TrackingForm } from './TrackingForm'
import { en } from '@/lib/i18n/en'

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('TrackingForm', () => {
  it('renders order number input field', () => {
    render(<TrackingForm />)
    expect(screen.getByLabelText(en.tracking.orderNumber)).toBeTruthy()
  })

  it('renders email/phone input field', () => {
    render(<TrackingForm />)
    expect(screen.getByLabelText(en.tracking.email)).toBeTruthy()
  })

  it('renders track button', () => {
    render(<TrackingForm />)
    expect(screen.getByRole('button', { name: en.tracking.track })).toBeTruthy()
  })

  it('typing updates order number field value', () => {
    render(<TrackingForm />)
    const input = screen.getByLabelText(en.tracking.orderNumber) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'ORD-123456' } })
    expect(input.value).toBe('ORD-123456')
  })

  it('typing updates contact field value', () => {
    render(<TrackingForm />)
    const input = screen.getByLabelText(en.tracking.email) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'test@example.com' } })
    expect(input.value).toBe('test@example.com')
  })

  it('shows required error when order number is empty on submit', () => {
    render(<TrackingForm />)
    fireEvent.click(screen.getByRole('button', { name: en.tracking.track }))
    const expected = en.errors.required.replace('{field}', en.tracking.orderNumber)
    expect(screen.getByText(expected)).toBeTruthy()
  })

  it('shows required error when contact is empty on submit', () => {
    render(<TrackingForm />)
    fireEvent.change(screen.getByLabelText(en.tracking.orderNumber), {
      target: { value: 'ORD-123456' },
    })
    fireEvent.click(screen.getByRole('button', { name: en.tracking.track }))
    const expected = en.errors.required.replace('{field}', en.tracking.email)
    expect(screen.getByText(expected)).toBeTruthy()
  })

  it('calls router.push with correct path when both fields filled', () => {
    render(<TrackingForm />)
    fireEvent.change(screen.getByLabelText(en.tracking.orderNumber), {
      target: { value: 'ORD-123456' },
    })
    fireEvent.change(screen.getByLabelText(en.tracking.email), {
      target: { value: 'user@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: en.tracking.track }))
    expect(mockPush).toHaveBeenCalledWith(
      `/track/ORD-123456?c=${encodeURIComponent('user@example.com')}`,
    )
  })

  it('trims whitespace before navigating', () => {
    render(<TrackingForm />)
    fireEvent.change(screen.getByLabelText(en.tracking.orderNumber), {
      target: { value: '  ORD-123456  ' },
    })
    fireEvent.change(screen.getByLabelText(en.tracking.email), {
      target: { value: '  user@example.com  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: en.tracking.track }))
    expect(mockPush).toHaveBeenCalledWith(
      `/track/ORD-123456?c=${encodeURIComponent('user@example.com')}`,
    )
  })
})
