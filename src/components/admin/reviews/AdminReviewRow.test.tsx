// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { AdminReviewRow } from './AdminReviewRow'
import { en } from '@/lib/i18n/en'
import type { AdminReview } from '@/lib/types/admin'

vi.mock('@/lib/api', () => ({
  apiPatch: vi.fn(() => Promise.resolve({})),
  apiDelete: vi.fn(() => Promise.resolve({})),
}))

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

import { apiPatch, apiDelete } from '@/lib/api'
import { toast } from 'sonner'

function makeReview(overrides: Partial<AdminReview> = {}): AdminReview {
  return {
    id: 'rev-1',
    orderId: 'order-1',
    productId: 'prod-1',
    productName: 'Blue Hoodie',
    customerName: 'Jane Doe',
    rating: 4,
    body: 'Great product, fits well.',
    photoUrl: null,
    photoR2Key: null,
    approved: false,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function renderRow(review: AdminReview, onChanged = vi.fn()) {
  // tr must be inside a table for valid DOM
  const result = render(
    <table><tbody><AdminReviewRow review={review} onChanged={onChanged} /></tbody></table>,
  )
  return { ...result, onChanged }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('AdminReviewRow', () => {
  it('renders pending badge + approve button when not approved', () => {
    renderRow(makeReview({ approved: false }))
    expect(screen.getByText(en.admin.pendingReviews)).toBeTruthy()
    expect(screen.getByText(en.admin.approveReview)).toBeTruthy()
    expect(screen.queryByText(en.admin.rejectReview)).toBeNull()
  })

  it('renders approved badge + reject button when approved', () => {
    renderRow(makeReview({ approved: true }))
    expect(screen.getByText(en.admin.approvedReviews)).toBeTruthy()
    expect(screen.getByText(en.admin.rejectReview)).toBeTruthy()
    expect(screen.queryByText(en.admin.approveReview)).toBeNull()
  })

  it('renders product name, customer name and body', () => {
    renderRow(makeReview())
    expect(screen.getByText('Blue Hoodie')).toBeTruthy()
    expect(screen.getByText('Jane Doe')).toBeTruthy()
    expect(screen.getByText('Great product, fits well.')).toBeTruthy()
  })

  it('renders a dash when body is empty', () => {
    renderRow(makeReview({ body: null }))
    expect(screen.getByText('—')).toBeTruthy()
  })

  it('approve calls apiPatch with approved:true, toasts success and calls onChanged', async () => {
    const { onChanged } = renderRow(makeReview({ approved: false }))
    fireEvent.click(screen.getByText(en.admin.approveReview))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(en.admin.reviewApproved))
    expect(apiPatch).toHaveBeenCalledWith('/api/admin/reviews/rev-1', { approved: true })
    expect(onChanged).toHaveBeenCalled()
  })

  it('approve failure toasts network error', async () => {
    ;(apiPatch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'))
    const { onChanged } = renderRow(makeReview({ approved: false }))
    fireEvent.click(screen.getByText(en.admin.approveReview))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(en.errors.networkError))
    expect(onChanged).not.toHaveBeenCalled()
  })

  it('reject calls apiPatch with approved:false and toasts success', async () => {
    const { onChanged } = renderRow(makeReview({ approved: true }))
    fireEvent.click(screen.getByText(en.admin.rejectReview))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(en.admin.reviewRejected))
    expect(apiPatch).toHaveBeenCalledWith('/api/admin/reviews/rev-1', { approved: false })
    expect(onChanged).toHaveBeenCalled()
  })

  it('reject failure toasts network error', async () => {
    ;(apiPatch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'))
    renderRow(makeReview({ approved: true }))
    fireEvent.click(screen.getByText(en.admin.rejectReview))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(en.errors.networkError))
  })

  it('delete confirmed calls apiDelete, toasts success and calls onChanged', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { onChanged } = renderRow(makeReview())
    fireEvent.click(screen.getByLabelText(en.admin.deleteReview))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(en.admin.reviewDeleted))
    expect(apiDelete).toHaveBeenCalledWith('/api/admin/reviews/rev-1')
    expect(onChanged).toHaveBeenCalled()
  })

  it('delete cancelled does nothing', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { onChanged } = renderRow(makeReview())
    fireEvent.click(screen.getByLabelText(en.admin.deleteReview))
    expect(apiDelete).not.toHaveBeenCalled()
    expect(onChanged).not.toHaveBeenCalled()
  })

  it('delete failure toasts network error', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    ;(apiDelete as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'))
    renderRow(makeReview())
    fireEvent.click(screen.getByLabelText(en.admin.deleteReview))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(en.errors.networkError))
  })
})
