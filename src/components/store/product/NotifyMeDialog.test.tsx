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
    expect(screen.getByText('Blue / M')).toBeTruthy()
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
})
