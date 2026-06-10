// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { toast } from 'sonner'
import { apiPost } from '@/lib/api'
import { ManualOrderForm } from './ManualOrderForm'
import { en, requiredMsg } from '@/lib/i18n/en'

const mockApiPost = vi.mocked(apiPost)

interface CartState {
  items: Array<Record<string, unknown>>
  couponCode: string | null
}

let cartState: CartState = { items: [], couponCode: null }
const push = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
}))

vi.mock('@/hooks/useCart', () => ({
  useCart: (selector: (s: CartState) => unknown) => selector(cartState),
}))

vi.mock('@/lib/api', () => ({
  apiPost: vi.fn(() => Promise.resolve({ orderId: 'o1', orderNumber: 'SF-9' })),
  apiGet: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
  prefetch: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

// Mock the Turnstile child so we can drive verify/error from the test.
vi.mock('@/components/store/checkout/TurnstileWidget', async () => {
  const { createElement } = await import('react')
  return {
    TurnstileWidget: ({
      onVerify,
      onError,
    }: {
      onVerify: (t: string) => void
      onError?: () => void
    }) =>
      createElement('div', {}, [
        createElement(
          'button',
          {
            key: 'v',
            type: 'button',
            onClick: () => onVerify('tok-1'),
            'data-testid': 'ts-verify',
          },
          'verify',
        ),
        createElement(
          'button',
          { key: 'e', type: 'button', onClick: () => onError?.(), 'data-testid': 'ts-error' },
          'error',
        ),
      ]),
  }
})

const baseProps = {
  endpoint: '/api/orders/cod',
  successMethod: 'cod',
  submitLabel: en.checkout.placeOrder,
}

function fillValidAddress() {
  fireEvent.change(screen.getByLabelText(en.checkout.name, { exact: false }), {
    target: { value: 'John Doe' },
  })
  fireEvent.change(screen.getByLabelText(en.checkout.phone, { exact: false }), {
    target: { value: '+923001234567' },
  })
  fireEvent.change(screen.getByLabelText(en.checkout.email, { exact: false }), {
    target: { value: 'buyer@example.com' },
  })
  fireEvent.change(screen.getByLabelText(en.checkout.address, { exact: false }), {
    target: { value: '123 Main Street' },
  })
  fireEvent.change(screen.getByLabelText(en.checkout.city, { exact: false }), {
    target: { value: 'Karachi' },
  })
  // postalCode is optional but, when present, schema requires min length 2;
  // an empty string fails validation silently (no error UI), so fill it.
  fireEvent.change(screen.getByLabelText(en.checkout.postalCode, { exact: false }), {
    target: { value: '75500' },
  })
}

beforeEach(() => {
  cartState = {
    items: [{ sizeOptionId: 'sz1', quantity: 2 }],
    couponCode: null,
  }
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ManualOrderForm', () => {
  it('renders all address fields and the submit label', () => {
    render(<ManualOrderForm {...baseProps} />)
    expect(screen.getByLabelText(en.checkout.name, { exact: false })).toBeTruthy()
    expect(screen.getByLabelText(en.checkout.phone, { exact: false })).toBeTruthy()
    expect(screen.getByLabelText(en.checkout.email, { exact: false })).toBeTruthy()
    expect(screen.getByLabelText(en.checkout.address, { exact: false })).toBeTruthy()
    expect(screen.getByLabelText(en.checkout.city, { exact: false })).toBeTruthy()
    expect(screen.getByLabelText(en.checkout.country, { exact: false })).toBeTruthy()
    expect(screen.getByRole('button', { name: en.checkout.placeOrder })).toBeTruthy()
  })

  it('defaults country to PK', () => {
    render(<ManualOrderForm {...baseProps} />)
    const country = screen.getByLabelText(en.checkout.country, {
      exact: false,
    }) as HTMLInputElement
    expect(country.value).toBe('PK')
  })

  it('disables submit until turnstile verified', () => {
    render(<ManualOrderForm {...baseProps} />)
    const btn = screen.getByRole('button', { name: en.checkout.placeOrder }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    fireEvent.click(screen.getByTestId('ts-verify'))
    expect(btn.disabled).toBe(false)
  })

  it('shows the security error message and re-disables submit on turnstile error', () => {
    render(<ManualOrderForm {...baseProps} />)
    fireEvent.click(screen.getByTestId('ts-verify'))
    fireEvent.click(screen.getByTestId('ts-error'))
    expect(screen.getByText(en.checkout.securityCheckFailed)).toBeTruthy()
    const btn = screen.getByRole('button', { name: en.checkout.placeOrder }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('shows validation errors when submitting an empty form', async () => {
    render(<ManualOrderForm {...baseProps} />)
    fireEvent.click(screen.getByTestId('ts-verify'))
    fireEvent.click(screen.getByRole('button', { name: en.checkout.placeOrder }))
    await waitFor(() => {
      expect(screen.getByText(requiredMsg(en.checkout.name))).toBeTruthy()
    })
    expect(mockApiPost).not.toHaveBeenCalled()
  })

  it('posts the order and routes to the success page on valid submit', async () => {
    render(<ManualOrderForm {...baseProps} />)
    fillValidAddress()
    fireEvent.click(screen.getByTestId('ts-verify'))
    fireEvent.click(screen.getByRole('button', { name: en.checkout.placeOrder }))

    await waitFor(() => expect(mockApiPost).toHaveBeenCalledTimes(1))

    const [endpoint, payload, opts] = mockApiPost.mock.calls[0] as [
      string,
      Record<string, unknown>,
      Record<string, unknown>,
    ]
    expect(endpoint).toBe('/api/orders/cod')
    expect(payload.items).toEqual([{ sizeOptionId: 'sz1', quantity: 2 }])
    expect((opts.headers as Record<string, string>)['X-Turnstile-Token']).toBe('tok-1')

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        expect.stringContaining('/checkout/success?method=cod&orderId=SF-9'),
      ),
    )
    // phone passed as contact hint ?c=
    expect(push.mock.calls[0][0]).toContain('&c=')
  })

  it('includes couponCode in payload when present in cart', async () => {
    cartState = {
      items: [{ sizeOptionId: 'sz1', quantity: 1 }],
      couponCode: 'SAVE10',
    }
    render(<ManualOrderForm {...baseProps} />)
    fillValidAddress()
    fireEvent.click(screen.getByTestId('ts-verify'))
    fireEvent.click(screen.getByRole('button', { name: en.checkout.placeOrder }))

    await waitFor(() => expect(mockApiPost).toHaveBeenCalled())
    const payload = mockApiPost.mock.calls[0][1] as Record<string, unknown>
    expect(payload.couponCode).toBe('SAVE10')
  })

  it('encodes the phone as the contact hint (?c=) on the success URL', async () => {
    render(<ManualOrderForm {...baseProps} />)
    fillValidAddress()
    fireEvent.click(screen.getByTestId('ts-verify'))
    fireEvent.click(screen.getByRole('button', { name: en.checkout.placeOrder }))

    await waitFor(() => expect(push).toHaveBeenCalled())
    expect(push.mock.calls[0][0]).toContain(`&c=${encodeURIComponent('+923001234567')}`)
  })

  it('shows an error toast when the order API fails', async () => {
    mockApiPost.mockRejectedValueOnce(new Error('boom'))
    render(<ManualOrderForm {...baseProps} />)
    fillValidAddress()
    fireEvent.click(screen.getByTestId('ts-verify'))
    fireEvent.click(screen.getByRole('button', { name: en.checkout.placeOrder }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(en.errors.orderFailed))
    expect(push).not.toHaveBeenCalled()
  })

  // ---- appended branch-coverage cases ----

  it('omits couponCode from the payload when the cart has none (falsy branch)', async () => {
    cartState = { items: [{ sizeOptionId: 'sz1', quantity: 1 }], couponCode: null }
    render(<ManualOrderForm {...baseProps} />)
    fillValidAddress()
    fireEvent.click(screen.getByTestId('ts-verify'))
    fireEvent.click(screen.getByRole('button', { name: en.checkout.placeOrder }))

    await waitFor(() => expect(mockApiPost).toHaveBeenCalled())
    const payload = mockApiPost.mock.calls[0][1] as Record<string, unknown>
    expect('couponCode' in payload).toBe(false)
  })

  it('blocks submission and toasts when the form is submitted without a turnstile token', async () => {
    const { container } = render(<ManualOrderForm {...baseProps} />)
    fillValidAddress()
    // Submit the form directly (bypassing the disabled button) so onSubmit runs
    // with turnstileToken still null -> hits the early-return guard + requiredMsg toast.
    const form = container.querySelector('form') as HTMLFormElement
    fireEvent.submit(form)

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(requiredMsg('Security check')))
    expect(mockApiPost).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })

  it('re-enables submit after a turnstile error is followed by a fresh verify', () => {
    render(<ManualOrderForm {...baseProps} />)
    const btn = screen.getByRole('button', { name: en.checkout.placeOrder }) as HTMLButtonElement
    // verify -> error clears token + shows message -> verify again clears error + re-enables
    fireEvent.click(screen.getByTestId('ts-verify'))
    fireEvent.click(screen.getByTestId('ts-error'))
    expect(screen.getByText(en.checkout.securityCheckFailed)).toBeTruthy()
    expect(btn.disabled).toBe(true)
    fireEvent.click(screen.getByTestId('ts-verify'))
    // onVerify branch sets turnstileError false -> message gone, button enabled
    expect(screen.queryByText(en.checkout.securityCheckFailed)).toBeNull()
    expect(btn.disabled).toBe(false)
  })

  it('shows the loading label while the order request is in flight (isSubmitting branch)', async () => {
    // Hold apiPost open so isSubmitting stays true and the button shows the '...' label.
    let resolvePost: (v: { orderId: string; orderNumber: string }) => void = () => {}
    mockApiPost.mockImplementationOnce(
      () =>
        new Promise((res) => {
          resolvePost = res
        }),
    )
    render(<ManualOrderForm {...baseProps} />)
    fillValidAddress()
    fireEvent.click(screen.getByTestId('ts-verify'))
    fireEvent.click(screen.getByRole('button', { name: en.checkout.placeOrder }))

    // While the promise is pending the button switches to the loading label '...'.
    await waitFor(() => expect(screen.getByRole('button', { name: '...' })).toBeTruthy())
    const btn = screen.getByRole('button', { name: '...' }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)

    // Resolve so the submit completes and routing fires (avoids dangling promise).
    resolvePost({ orderId: 'o1', orderNumber: 'SF-9' })
    await waitFor(() => expect(push).toHaveBeenCalled())
  })
})
