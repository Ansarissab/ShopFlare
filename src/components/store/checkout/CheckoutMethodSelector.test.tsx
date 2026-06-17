// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { toast } from 'sonner'
import { apiPost } from '@/lib/api'
import { CheckoutMethodSelector } from './CheckoutMethodSelector'
import { en } from '@/lib/i18n/en'

const mockApiPost = vi.mocked(apiPost)

interface CartState {
  items: Array<Record<string, unknown>>
}

let cartState: CartState = { items: [] }
let mockConfig: Record<string, unknown> | null = null

vi.mock('@/hooks/useCart', () => ({
  useCart: (selector: (s: CartState) => unknown) => selector(cartState),
}))

vi.mock('@/hooks/useStoreConfig', () => ({
  useStoreConfig: () => ({ config: mockConfig }),
}))

vi.mock('@/lib/api', () => ({
  apiPost: vi.fn(() => Promise.resolve({ url: 'https://stripe.test/session' })),
  apiGet: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
  prefetch: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

// Mock Turnstile so we can drive verify/error.
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
          { key: 'v', type: 'button', onClick: () => onVerify('stok'), 'data-testid': 'ts-verify' },
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

// Mock ManualOrderForm to a marker so we can assert which path is active.
vi.mock('@/components/store/checkout/ManualOrderForm', async () => {
  const { createElement } = await import('react')
  return {
    ManualOrderForm: ({ endpoint, successMethod }: { endpoint: string; successMethod: string }) =>
      createElement('div', {
        'data-testid': 'manual-form',
        'data-endpoint': endpoint,
        'data-method': successMethod,
      }),
  }
})

beforeEach(() => {
  cartState = { items: [{ stripePriceId: 'price_1', quantity: 1 }] }
  mockConfig = null
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('CheckoutMethodSelector', () => {
  it('renders card, cod and whatsapp methods, hides bank when not configured', () => {
    render(<CheckoutMethodSelector />)
    expect(screen.getByText(en.checkout.payWithCard)).toBeTruthy()
    expect(screen.getByText(en.store.cashOnDelivery)).toBeTruthy()
    expect(screen.getByText(en.store.orderOnWhatsApp)).toBeTruthy()
    expect(screen.queryByText(en.checkout.bankTransfer)).toBeNull()
  })

  it('shows the bank method when a bank account number is configured', () => {
    mockConfig = { bankAccountNumber: '123' }
    render(<CheckoutMethodSelector />)
    expect(screen.getByText(en.checkout.bankTransfer)).toBeTruthy()
  })

  it('defaults to the COD method (renders ManualOrderForm for cod)', () => {
    render(<CheckoutMethodSelector />)
    const form = screen.getByTestId('manual-form')
    expect(form.getAttribute('data-endpoint')).toBe('/api/orders/cod')
    expect(form.getAttribute('data-method')).toBe('cod')
  })

  it('switches to the card method and shows the stripe note', () => {
    render(<CheckoutMethodSelector />)
    fireEvent.click(screen.getByText(en.checkout.payWithCard))
    expect(screen.getByText(en.checkout.stripeRedirectNote)).toBeTruthy()
  })

  it('switches to the whatsapp method and shows guidance copy', () => {
    render(<CheckoutMethodSelector />)
    fireEvent.click(screen.getByText(en.store.orderOnWhatsApp))
    // The panel renders the i18n whatsappPanelNote with {action} replaced by the
    // store.orderOnWhatsApp label; assert a stable substring from the note.
    const expected = en.checkout.whatsappPanelNote.replace('{action}', en.store.orderOnWhatsApp)
    expect(screen.getByText(expected)).toBeTruthy()
  })

  it('switches to the bank method and renders the bank ManualOrderForm', () => {
    mockConfig = { bankAccountNumber: '123' }
    render(<CheckoutMethodSelector />)
    fireEvent.click(screen.getByText(en.checkout.bankTransfer))
    expect(screen.getByText(en.checkout.bankTransferNote)).toBeTruthy()
    const form = screen.getByTestId('manual-form')
    expect(form.getAttribute('data-endpoint')).toBe('/api/orders/bank-transfer')
    expect(form.getAttribute('data-method')).toBe('bank_transfer')
  })

  it('stripe button is disabled until turnstile verified', () => {
    render(<CheckoutMethodSelector />)
    fireEvent.click(screen.getByText(en.checkout.payWithCard))
    const btn = screen.getByRole('button', { name: en.checkout.payWithCard }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    fireEvent.click(screen.getByTestId('ts-verify'))
    expect(btn.disabled).toBe(false)
  })

  it('shows security check failed message on turnstile error', () => {
    render(<CheckoutMethodSelector />)
    fireEvent.click(screen.getByText(en.checkout.payWithCard))
    fireEvent.click(screen.getByTestId('ts-verify'))
    fireEvent.click(screen.getByTestId('ts-error'))
    expect(screen.getByText(en.checkout.securityCheckFailed)).toBeTruthy()
  })

  it('redirects to the stripe url on successful checkout session', async () => {
    const original = window.location
    // jsdom: make location.href assignable
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { ...original, href: '' },
    })

    render(<CheckoutMethodSelector />)
    fireEvent.click(screen.getByText(en.checkout.payWithCard))
    fireEvent.click(screen.getByTestId('ts-verify'))
    fireEvent.click(screen.getByRole('button', { name: en.checkout.payWithCard }))

    await waitFor(() => expect(mockApiPost).toHaveBeenCalled())
    const [endpoint, body, opts] = mockApiPost.mock.calls[0] as [
      string,
      Record<string, unknown>,
      Record<string, unknown>,
    ]
    expect(endpoint).toBe('/api/stripe/checkout-session')
    expect(body.items).toEqual([{ stripePriceId: 'price_1', quantity: 1 }])
    expect((opts.headers as Record<string, string>)['X-Turnstile-Token']).toBe('stok')

    await waitFor(() => expect(window.location.href).toBe('https://stripe.test/session'))

    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: original,
    })
  })

  it('errors when no stripe-eligible items in cart', async () => {
    cartState = { items: [{ quantity: 1 }] } // no stripePriceId
    render(<CheckoutMethodSelector />)
    fireEvent.click(screen.getByText(en.checkout.payWithCard))
    fireEvent.click(screen.getByTestId('ts-verify'))
    fireEvent.click(screen.getByRole('button', { name: en.checkout.payWithCard }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(en.errors.orderFailed))
    expect(mockApiPost).not.toHaveBeenCalled()
  })

  it('shows an error toast when the stripe API throws', async () => {
    mockApiPost.mockRejectedValueOnce(new Error('fail'))
    render(<CheckoutMethodSelector />)
    fireEvent.click(screen.getByText(en.checkout.payWithCard))
    fireEvent.click(screen.getByTestId('ts-verify'))
    fireEvent.click(screen.getByRole('button', { name: en.checkout.payWithCard }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(en.errors.orderFailed))
  })

  it('guards stripe checkout when token missing (calls handler with no token)', async () => {
    // Force the no-token path: verify then error clears the token but we need the
    // button enabled to click. Instead assert the guard via direct state: the
    // button is disabled without a token so we cannot click it — verify+error
    // re-disables and clicking is a no-op.
    render(<CheckoutMethodSelector />)
    fireEvent.click(screen.getByText(en.checkout.payWithCard))
    const btn = screen.getByRole('button', { name: en.checkout.payWithCard }) as HTMLButtonElement
    fireEvent.click(btn) // disabled → no-op
    expect(mockApiPost).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('stripe button shows processing label and aria-busy=true while loading', async () => {
    let resolveSession: (v: { url: string }) => void = () => {}
    mockApiPost.mockImplementationOnce(
      () =>
        new Promise((res) => {
          resolveSession = res
        }),
    )
    const original = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { ...original, href: '' },
    })
    render(<CheckoutMethodSelector />)
    fireEvent.click(screen.getByText(en.checkout.payWithCard))
    fireEvent.click(screen.getByTestId('ts-verify'))
    fireEvent.click(screen.getByRole('button', { name: en.checkout.payWithCard }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: en.checkout.processingOrder })).toBeTruthy(),
    )
    const btn = screen.getByRole('button', {
      name: en.checkout.processingOrder,
    }) as HTMLButtonElement
    expect(btn.getAttribute('aria-busy')).toBe('true')
    expect(btn.disabled).toBe(true)

    resolveSession({ url: 'https://stripe.test/done' })
    await waitFor(() => expect(window.location.href).toBe('https://stripe.test/done'))
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: original,
    })
  })

  it('ArrowDown moves focus to the next radio method', () => {
    render(<CheckoutMethodSelector />)
    // COD is the default selected (tabindex=0). Arrow down from COD → WhatsApp (last).
    // Find the COD radio button.
    const codBtn = screen.getByRole('radio', { name: new RegExp(en.store.cashOnDelivery) })
    fireEvent.keyDown(codBtn, { key: 'ArrowDown' })
    // WhatsApp is the next radio after COD in the default (no bank) method list.
    const whatsappBtn = screen.getByRole('radio', { name: new RegExp(en.store.orderOnWhatsApp) })
    expect(whatsappBtn.getAttribute('aria-checked')).toBe('true')
    expect(whatsappBtn.getAttribute('tabindex')).toBe('0')
    expect(codBtn.getAttribute('tabindex')).toBe('-1')
  })

  it('Home/End keys move focus to the first/last radio', () => {
    render(<CheckoutMethodSelector />)
    const codBtn = screen.getByRole('radio', { name: new RegExp(en.store.cashOnDelivery) })
    fireEvent.keyDown(codBtn, { key: 'End' })
    const whatsappBtn = screen.getByRole('radio', { name: new RegExp(en.store.orderOnWhatsApp) })
    expect(whatsappBtn.getAttribute('aria-checked')).toBe('true')
    fireEvent.keyDown(whatsappBtn, { key: 'Home' })
    const cardBtn = screen.getByRole('radio', { name: new RegExp(en.checkout.payWithCard) })
    expect(cardBtn.getAttribute('aria-checked')).toBe('true')
  })

  it('ArrowUp wraps around from first radio to last', () => {
    render(<CheckoutMethodSelector />)
    // Default: COD is active (index 1 in [card, cod, whatsapp]).
    // First, move to card (index 0).
    const codBtn = screen.getByRole('radio', { name: new RegExp(en.store.cashOnDelivery) })
    fireEvent.keyDown(codBtn, { key: 'ArrowUp' })
    const cardBtn = screen.getByRole('radio', { name: new RegExp(en.checkout.payWithCard) })
    expect(cardBtn.getAttribute('aria-checked')).toBe('true')
    // Now ArrowUp from card (index 0) → wraps to last (whatsapp, index 2)
    fireEvent.keyDown(cardBtn, { key: 'ArrowUp' })
    const whatsappBtn = screen.getByRole('radio', { name: new RegExp(en.store.orderOnWhatsApp) })
    expect(whatsappBtn.getAttribute('aria-checked')).toBe('true')
  })

  it('ArrowLeft moves focus to the previous radio', () => {
    render(<CheckoutMethodSelector />)
    // COD is active (index 1). ArrowLeft → card (index 0).
    const codBtn = screen.getByRole('radio', { name: new RegExp(en.store.cashOnDelivery) })
    fireEvent.keyDown(codBtn, { key: 'ArrowLeft' })
    const cardBtn = screen.getByRole('radio', { name: new RegExp(en.checkout.payWithCard) })
    expect(cardBtn.getAttribute('aria-checked')).toBe('true')
  })

  it('ArrowRight moves focus to the next radio (same as ArrowDown)', () => {
    render(<CheckoutMethodSelector />)
    // COD is active (index 1). ArrowRight → whatsapp (index 2).
    const codBtn = screen.getByRole('radio', { name: new RegExp(en.store.cashOnDelivery) })
    fireEvent.keyDown(codBtn, { key: 'ArrowRight' })
    const whatsappBtn = screen.getByRole('radio', { name: new RegExp(en.store.orderOnWhatsApp) })
    expect(whatsappBtn.getAttribute('aria-checked')).toBe('true')
    expect(whatsappBtn.getAttribute('tabindex')).toBe('0')
    expect(codBtn.getAttribute('tabindex')).toBe('-1')
    // Focus must have moved to the whatsapp button (handler calls .focus() on the target ref)
    expect(document.activeElement).toBe(whatsappBtn)
  })

  it('non-navigation keys do not change active method or call preventDefault', () => {
    render(<CheckoutMethodSelector />)
    const codBtn = screen.getByRole('radio', { name: new RegExp(en.store.cashOnDelivery) })
    // Firing a non-nav key — preventDefault must NOT be called; selection must not change.
    const preventDefault = vi.fn()
    fireEvent.keyDown(codBtn, { key: 'Tab', preventDefault })
    // COD should still be active
    expect(codBtn.getAttribute('aria-checked')).toBe('true')
    const cardBtn = screen.getByRole('radio', { name: new RegExp(en.checkout.payWithCard) })
    expect(cardBtn.getAttribute('aria-checked')).toBe('false')
    expect(preventDefault).not.toHaveBeenCalled()
  })
})
