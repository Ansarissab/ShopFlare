// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { NotifyMeDialog } from './NotifyMeDialog'
import { en } from '@/lib/i18n/en'
import { apiPost } from '@/lib/api'

vi.mock('@/lib/api', () => ({
  apiPost: vi.fn(() => Promise.resolve({})),
}))

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

import { toast } from 'sonner'

const apiPostMock = vi.mocked(apiPost)
const toastSuccess = vi.mocked(toast.success)
const toastError = vi.mocked(toast.error)

function baseProps(over: Record<string, unknown> = {}) {
  return {
    sizeOptionId: 'size-1',
    productName: 'Hoodie',
    size: 'M',
    variantLabel: 'Blue',
    open: true,
    onOpenChange: vi.fn(),
    ...over,
  }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('NotifyMeDialog', () => {
  it('does not render content when closed', () => {
    render(<NotifyMeDialog {...baseProps({ open: false })} />)
    expect(screen.queryByText(en.store.notifyMe)).toBeNull()
  })

  it('renders the dialog with the variant/size in the description', () => {
    render(<NotifyMeDialog {...baseProps()} />)
    // notifyMe text appears in both title and the submit button
    expect(screen.getAllByText(en.store.notifyMe).length).toBeGreaterThan(0)
    expect(
      screen.getByText(
        en.store.notifyMeDescription.replace('{variant}', 'Blue').replace('{size}', 'M'),
      ),
    ).toBeTruthy()
    expect(screen.getByLabelText(en.checkout.email)).toBeTruthy()
    expect(screen.getByLabelText(en.checkout.phone)).toBeTruthy()
  })

  it('submits with email + phone, shows success toast, resets and closes', async () => {
    const props = baseProps()
    render(<NotifyMeDialog {...props} />)
    fireEvent.change(screen.getByLabelText(en.checkout.email), {
      target: { value: 'a@b.com' },
    })
    fireEvent.change(screen.getByLabelText(en.checkout.phone), {
      target: { value: '+15550001111' },
    })
    fireEvent.click(screen.getByRole('button', { name: en.store.notifyMe }))

    await waitFor(() => expect(apiPostMock).toHaveBeenCalledTimes(1))
    expect(apiPostMock).toHaveBeenCalledWith('/api/notify', {
      sizeOptionId: 'size-1',
      email: 'a@b.com',
      phone: '+15550001111',
    })
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith(en.store.notifySuccess))
    expect(props.onOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows a network-error toast when the request fails', async () => {
    apiPostMock.mockRejectedValueOnce(new Error('boom'))
    render(<NotifyMeDialog {...baseProps()} />)
    fireEvent.change(screen.getByLabelText(en.checkout.email), {
      target: { value: 'a@b.com' },
    })
    fireEvent.change(screen.getByLabelText(en.checkout.phone), {
      target: { value: '+15550001111' },
    })
    fireEvent.click(screen.getByRole('button', { name: en.store.notifyMe }))

    await waitFor(() => expect(toastError).toHaveBeenCalledWith(en.errors.networkError))
  })

  it('shows the invalid-phone error when the phone is malformed', async () => {
    render(<NotifyMeDialog {...baseProps()} />)
    fireEvent.change(screen.getByLabelText(en.checkout.email), {
      target: { value: 'a@b.com' },
    })
    fireEvent.change(screen.getByLabelText(en.checkout.phone), {
      target: { value: 'abc' },
    })
    fireEvent.click(screen.getByRole('button', { name: en.store.notifyMe }))
    await waitFor(() => expect(screen.getByText(en.errors.invalidPhone)).toBeTruthy())
    expect(apiPostMock).not.toHaveBeenCalled()
  })

  it('shows the invalid-email error when the email field is malformed', async () => {
    // Exercises the `errors.email &&` branch in JSX (only errors.phone was previously tested)
    render(<NotifyMeDialog {...baseProps()} />)
    fireEvent.change(screen.getByLabelText(en.checkout.email), {
      target: { value: 'not-an-email' },
    })
    // Leave phone empty — both email and phone invalid → neither condition in refinement passes
    // → schema errors on both fields → errors.email shows its message.
    // Dialog renders in a portal so we query from the document, not the container.
    const form = document.querySelector('form') as HTMLFormElement
    fireEvent.submit(form)
    await waitFor(() => expect(screen.getByText(en.errors.invalidEmail)).toBeTruthy(), {
      timeout: 3000,
    })
    expect(apiPostMock).not.toHaveBeenCalled()
  })

  it('renders description with empty variantLabel and size when both are empty strings', () => {
    // Exercises the replace('{variant}', '').replace('{size}', '') branches.
    // The resulting string "We'll let you know when  /  is back in stock." has extra
    // spaces (where the interpolated values were), so use a partial text match.
    render(<NotifyMeDialog {...baseProps({ variantLabel: '', size: '' })} />)
    // "notifyMeDescription" has {variant} and {size} replaced with '' → two consecutive
    // spaces remain; use a function matcher to avoid whitespace normalisation issues.
    expect(
      screen.getByText(
        (content) => content.includes('let you know when') && content.includes('is back in stock'),
      ),
    ).toBeTruthy()
  })

  it('shows invalid-email error when phone is valid but email field has a bad value', async () => {
    // Exercises the `errors.email &&` JSX branch: an invalid email string triggers the error
    // display even when a valid phone is also provided.
    // The zod schema validates email individually (z.string().email()) before the
    // cross-field refinement runs — a bad email value always produces an error.
    const props = baseProps()
    render(<NotifyMeDialog {...props} />)
    fireEvent.change(screen.getByLabelText(en.checkout.email), {
      target: { value: 'not-valid' },
    })
    fireEvent.change(screen.getByLabelText(en.checkout.phone), {
      target: { value: '+15550001111' },
    })
    // Submit via the form element (same approach as the existing invalidEmail test above)
    const form = document.querySelector('form') as HTMLFormElement
    fireEvent.submit(form)

    // Bad email → validation fires → invalidEmail error shown, apiPost never called.
    await waitFor(() => expect(screen.getByText(en.errors.invalidEmail)).toBeTruthy(), {
      timeout: 3000,
    })
    expect(apiPostMock).not.toHaveBeenCalled()
  })
})
