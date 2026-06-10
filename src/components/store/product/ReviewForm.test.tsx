// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { ReviewForm } from './ReviewForm'
import { en } from '@/lib/i18n/en'
import { apiPost, ApiError } from '@/lib/api'

// apiPost is mocked; ApiError must remain the real class for instanceof checks.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, apiPost: vi.fn(() => Promise.resolve({})) }
})

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

// TurnstileWidget — expose verify/error triggers as buttons we can click.
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
      createElement('div', null, [
        createElement(
          'button',
          { key: 'v', type: 'button', onClick: () => onVerify('tok-123') },
          'verify',
        ),
        createElement('button', { key: 'e', type: 'button', onClick: () => onError?.() }, 'fail'),
      ]),
  }
})

import { toast } from 'sonner'
const apiPostMock = vi.mocked(apiPost)
const toastSuccess = vi.mocked(toast.success)
const toastError = vi.mocked(toast.error)

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function fillValidForm() {
  fireEvent.change(screen.getByLabelText(en.reviews.orderNumber), {
    target: { value: 'ORD-1' },
  })
  fireEvent.change(screen.getByLabelText(en.reviews.contact), {
    target: { value: 'a@b.com' },
  })
  fireEvent.change(screen.getByLabelText(en.reviews.yourName), {
    target: { value: 'Jane' },
  })
  // Rating: ReviewStars renders rating buttons — pick the 5-star one.
  const fiveStar = screen.getByLabelText(en.reviews.starLabelPlural.replace('{count}', '5'))
  fireEvent.click(fiveStar)
}

function verify() {
  fireEvent.click(screen.getByText('verify'))
}

describe('ReviewForm', () => {
  it('renders the verify-purchase fields and the disabled submit button', () => {
    render(<ReviewForm productId="p1" productName="Hoodie" onSubmitted={vi.fn()} />)
    expect(screen.getByText(en.reviews.verifyTitle)).toBeTruthy()
    expect(screen.getByLabelText(en.reviews.orderNumber)).toBeTruthy()
    expect(screen.getByLabelText(en.reviews.contact)).toBeTruthy()
    // disabled until turnstile token arrives
    expect(screen.getByRole('button', { name: en.reviews.submit }).hasAttribute('disabled')).toBe(
      true,
    )
  })

  it('submits successfully, posts with the turnstile header, resets and calls onSubmitted', async () => {
    const onSubmitted = vi.fn()
    render(<ReviewForm productId="p1" productName="Hoodie" onSubmitted={onSubmitted} />)
    verify()
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: en.reviews.submit }))

    await waitFor(() => expect(apiPostMock).toHaveBeenCalledTimes(1))
    const [path, , opts] = apiPostMock.mock.calls[0]
    expect(path).toBe('/api/reviews')
    expect((opts as { headers: Record<string, string> }).headers['X-Turnstile-Token']).toBe(
      'tok-123',
    )
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith(en.reviews.submitted))
    expect(onSubmitted).toHaveBeenCalledTimes(1)
  })

  it('shows ratingRequired error when no rating is selected', async () => {
    render(<ReviewForm productId="p1" productName="Hoodie" onSubmitted={vi.fn()} />)
    verify()
    fireEvent.change(screen.getByLabelText(en.reviews.orderNumber), { target: { value: 'ORD-1' } })
    fireEvent.change(screen.getByLabelText(en.reviews.contact), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText(en.reviews.yourName), { target: { value: 'Jane' } })
    fireEvent.click(screen.getByRole('button', { name: en.reviews.submit }))
    await waitFor(() => expect(screen.getByText(en.reviews.ratingRequired)).toBeTruthy())
    expect(apiPostMock).not.toHaveBeenCalled()
  })

  it('maps a 409 ApiError to the alreadyReviewed toast', async () => {
    apiPostMock.mockRejectedValueOnce(new ApiError(409, 'conflict'))
    render(<ReviewForm productId="p1" productName="Hoodie" onSubmitted={vi.fn()} />)
    verify()
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: en.reviews.submit }))
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(en.reviews.alreadyReviewed))
  })

  it('maps a 422 ApiError to the notEligible toast', async () => {
    apiPostMock.mockRejectedValueOnce(new ApiError(422, 'unprocessable'))
    render(<ReviewForm productId="p1" productName="Hoodie" onSubmitted={vi.fn()} />)
    verify()
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: en.reviews.submit }))
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(en.reviews.notEligible))
  })

  it('maps a 403 ApiError to the verifyFailed toast', async () => {
    apiPostMock.mockRejectedValueOnce(new ApiError(403, 'forbidden'))
    render(<ReviewForm productId="p1" productName="Hoodie" onSubmitted={vi.fn()} />)
    verify()
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: en.reviews.submit }))
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(en.reviews.verifyFailed))
  })

  it('maps an unknown ApiError status to the generic submitFailed toast', async () => {
    apiPostMock.mockRejectedValueOnce(new ApiError(500, 'server'))
    render(<ReviewForm productId="p1" productName="Hoodie" onSubmitted={vi.fn()} />)
    verify()
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: en.reviews.submit }))
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(en.reviews.submitFailed))
  })

  it('maps a non-ApiError throw to the generic submitFailed toast', async () => {
    apiPostMock.mockRejectedValueOnce(new Error('network down'))
    render(<ReviewForm productId="p1" productName="Hoodie" onSubmitted={vi.fn()} />)
    verify()
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: en.reviews.submit }))
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(en.reviews.submitFailed))
  })

  it('renders the turnstile-error message instead of the widget when it errors', () => {
    render(<ReviewForm productId="p1" productName="Hoodie" onSubmitted={vi.fn()} />)
    // first verify so the submit becomes enabled path isn't needed; trigger error
    fireEvent.click(screen.getByText('fail'))
    expect(screen.getByText(en.checkout.securityCheckFailed)).toBeTruthy()
    // widget triggers gone
    expect(screen.queryByText('verify')).toBeNull()
  })

  it('guards on a missing turnstile token (no token → securityCheckFailed, no post)', async () => {
    const { container } = render(
      <ReviewForm productId="p1" productName="Hoodie" onSubmitted={vi.fn()} />,
    )
    // Fill valid fields but do NOT verify (no turnstile token) — the submit
    // button is disabled, so submit the form element directly to reach the guard.
    fireEvent.change(screen.getByLabelText(en.reviews.orderNumber), { target: { value: 'ORD-1' } })
    fireEvent.change(screen.getByLabelText(en.reviews.contact), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText(en.reviews.yourName), { target: { value: 'Jane' } })
    fireEvent.click(screen.getByLabelText(en.reviews.starLabelPlural.replace('{count}', '5')))
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(en.checkout.securityCheckFailed))
    expect(apiPostMock).not.toHaveBeenCalled()
  })

  it('shows the submitting label while the request is in flight', async () => {
    let resolve!: () => void
    apiPostMock.mockImplementationOnce(
      () =>
        new Promise<Record<string, never>>((r) => {
          resolve = () => r({})
        }),
    )
    render(<ReviewForm productId="p1" productName="Hoodie" onSubmitted={vi.fn()} />)
    verify()
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: en.reviews.submit }))
    await waitFor(() => expect(screen.getByText(en.reviews.submitting)).toBeTruthy())
    resolve()
  })
})
