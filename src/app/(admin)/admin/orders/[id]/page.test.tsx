// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import AdminOrderDetailPage from './page'
import { en } from '@/lib/i18n/en'
import type { AdminOrderDetail } from '@/lib/types/admin'

// ── next/navigation ──────────────────────────────────────────────────────────
const refreshMock = vi.fn()
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'order-123' }),
  useRouter: () => ({ refresh: refreshMock, push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}))

// ── API ───────────────────────────────────────────────────────────────────────
vi.mock('@/lib/api', () => ({
  apiPatch: vi.fn(() => Promise.resolve({})),
}))

// ── Sonner toasts ─────────────────────────────────────────────────────────────
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

// ── next/image ────────────────────────────────────────────────────────────────
vi.mock('next/image', async () => {
  const { createElement } = await import('react')
  return {
    default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) => {
      const { fill, ...rest } = props
      return createElement('img', rest)
    },
  }
})

// ── shadcn/ui Select — Radix doesn't work in jsdom; expose onValueChange via data attr ──
vi.mock('@/components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string
    onValueChange?: (v: string) => void
    children?: React.ReactNode
  }) => (
    <div data-testid="select" data-value={value} data-on-change={String(onValueChange)}>
      <button type="button" data-testid="select-trigger" onClick={() => onValueChange?.('shipped')}>
        select-trigger
      </button>
      {children}
    </div>
  ),
  SelectTrigger: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  SelectItem: ({
    value,
    children,
    onClick,
  }: {
    value?: string
    children?: React.ReactNode
    onClick?: () => void
  }) => (
    <button type="button" data-value={value} onClick={onClick}>
      {children}
    </button>
  ),
}))

// ── useApiResource — controllable per-test ────────────────────────────────────
let apiResourceState: { data: AdminOrderDetail | null; loading: boolean; notFound: boolean } = {
  data: null,
  loading: false,
  notFound: false,
}

vi.mock('@/hooks/useApiResource', () => ({
  useApiResource: () => apiResourceState,
}))

import { apiPatch } from '@/lib/api'
import { toast } from 'sonner'

// ── fixtures ──────────────────────────────────────────────────────────────────
function makeOrderDetail(overrides: Partial<AdminOrderDetail['order']> = {}): AdminOrderDetail {
  return {
    order: {
      id: 'order-123',
      orderNumber: 'ORD-001',
      status: 'pending',
      paymentMethod: 'cod',
      customerName: 'Jane Doe',
      customerEmail: 'jane@example.com',
      customerPhone: null,
      totalCents: 5000,
      subtotalCents: 4500,
      shippingCents: 500,
      discountCents: 0,
      taxCents: 0,
      couponCode: null,
      trackingNumber: null,
      carrier: null,
      notes: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      ...overrides,
    },
    items: [
      {
        id: 'item-1',
        sizeOptionId: 'size-1',
        productId: 'prod-1',
        variantId: 'var-1',
        quantity: 2,
        priceCents: 2250,
        snapshot: {
          productName: 'Blue Hoodie',
          variantLabel: 'Blue',
          size: 'M',
          imageUrl: '/images/hoodie.jpg',
        },
      },
    ],
    shippingAddress: null,
  }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  apiResourceState = { data: null, loading: false, notFound: false }
})

// ── tests ─────────────────────────────────────────────────────────────────────
describe('AdminOrderDetailPage', () => {
  it('renders loading skeletons while loading', () => {
    apiResourceState = { data: null, loading: true, notFound: false }
    const { container } = render(<AdminOrderDetailPage />)
    // shadcn Skeleton renders divs with animate-pulse
    expect(container.querySelectorAll('[class*="animate-pulse"]').length).toBeGreaterThan(0)
  })

  it('renders not-found state when notFound=true', () => {
    apiResourceState = { data: null, loading: false, notFound: true }
    render(<AdminOrderDetailPage />)
    expect(screen.getByText(en.admin.orderNotFound)).toBeTruthy()
    expect(screen.getByText(en.admin.backToOrders)).toBeTruthy()
  })

  it('renders order number and customer name', () => {
    apiResourceState = { data: makeOrderDetail(), loading: false, notFound: false }
    render(<AdminOrderDetailPage />)
    expect(screen.getByText(/ORD-001/)).toBeTruthy()
    expect(screen.getByText('Jane Doe')).toBeTruthy()
  })

  it('renders i18n Items heading', () => {
    apiResourceState = { data: makeOrderDetail(), loading: false, notFound: false }
    render(<AdminOrderDetailPage />)
    expect(screen.getByText(en.admin.orderItems)).toBeTruthy()
  })

  it('renders i18n Discount label with coupon code', () => {
    apiResourceState = {
      data: makeOrderDetail({ discountCents: 500, couponCode: 'SAVE10' }),
      loading: false,
      notFound: false,
    }
    render(<AdminOrderDetailPage />)
    expect(screen.getByText(`${en.admin.orderDiscount} (SAVE10)`)).toBeTruthy()
  })

  describe('handleStatusUpdate', () => {
    it('calls apiPatch, clears optimistic state, and calls router.refresh on success', async () => {
      apiResourceState = { data: makeOrderDetail(), loading: false, notFound: false }
      render(<AdminOrderDetailPage />)

      // The mocked Select's trigger fires onValueChange('shipped') on click
      fireEvent.click(screen.getByTestId('select-trigger'))

      // Click the Update Status button (now enabled since newStatus is set)
      const updateBtn = screen.getByRole('button', { name: en.admin.updateStatus })
      fireEvent.click(updateBtn)

      await waitFor(() =>
        expect(apiPatch).toHaveBeenCalledWith('/api/admin/orders/order-123/status', {
          status: 'shipped',
        }),
      )
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith(en.admin.statusUpdated))
      await waitFor(() => expect(refreshMock).toHaveBeenCalled())

      // After success the optimistic override is cleared — badge falls back to the
      // server-confirmed status label (the fixture has status 'pending').
      // Multiple elements may match (Select item + badge), so use getAllByText.
      expect(
        screen
          .getAllByText(
            new RegExp(en.orderStatusLabels['pending' as keyof typeof en.orderStatusLabels], 'i'),
          )
          .some((el) => el.getAttribute('data-slot') === 'badge'),
      ).toBe(true)
    })

    it('rolls back to server baseline and toasts error on apiPatch failure; does NOT refresh', async () => {
      ;(apiPatch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network'))
      // Server state: status = 'pending'
      apiResourceState = { data: makeOrderDetail(), loading: false, notFound: false }
      render(<AdminOrderDetailPage />)

      // Trigger optimistic update to 'shipped'
      fireEvent.click(screen.getByTestId('select-trigger'))

      const updateBtn = screen.getByRole('button', { name: en.admin.updateStatus })
      fireEvent.click(updateBtn)

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith(en.errors.networkError))
      // Refresh must NOT be called on failure
      expect(refreshMock).not.toHaveBeenCalled()
      // Badge must show the server-confirmed value ('pending'), not the failed optimistic one.
      // Multiple elements may match (Select item + badge), so use getAllByText.
      expect(
        screen
          .getAllByText(
            new RegExp(en.orderStatusLabels['pending' as keyof typeof en.orderStatusLabels], 'i'),
          )
          .some((el) => el.getAttribute('data-slot') === 'badge'),
      ).toBe(true)
    })
  })

  describe('handleTrackingUpdate', () => {
    it('calls apiPatch, clears optimistic state, and calls router.refresh on success', async () => {
      apiResourceState = { data: makeOrderDetail(), loading: false, notFound: false }
      render(<AdminOrderDetailPage />)

      const trackingInput = screen.getByPlaceholderText(en.admin.trackingNumber)
      fireEvent.change(trackingInput, { target: { value: 'TRACK123' } })

      const addBtn = screen.getByRole('button', { name: en.admin.addTracking })
      fireEvent.click(addBtn)

      await waitFor(() =>
        expect(apiPatch).toHaveBeenCalledWith('/api/admin/orders/order-123/tracking', {
          trackingNumber: 'TRACK123',
          carrier: undefined,
        }),
      )
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith(en.admin.trackingAdded))
      await waitFor(() => expect(refreshMock).toHaveBeenCalled())

      // After success the optimistic override is cleared — the component falls back to
      // server data (fixture has no trackingNumber, so the tracking section is hidden)
      expect(screen.queryByText(/TRACK123/)).toBeNull()
    })

    it('rolls back to server baseline and toasts error on failure; does NOT refresh', async () => {
      ;(apiPatch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network'))
      // Server state: no tracking number
      apiResourceState = { data: makeOrderDetail(), loading: false, notFound: false }
      render(<AdminOrderDetailPage />)

      const trackingInput = screen.getByPlaceholderText(en.admin.trackingNumber)
      fireEvent.change(trackingInput, { target: { value: 'TRACK999' } })

      const addBtn = screen.getByRole('button', { name: en.admin.addTracking })
      fireEvent.click(addBtn)

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith(en.errors.networkError))
      // Refresh must NOT be called on failure
      expect(refreshMock).not.toHaveBeenCalled()
      // Rolled back to server baseline (null) — tracking section not rendered
      expect(screen.queryByText(/TRACK999/)).toBeNull()
    })
  })

  it('shows existing tracking number from server data', () => {
    apiResourceState = {
      data: makeOrderDetail({ trackingNumber: 'EXISTING-TRACK', carrier: 'DHL' }),
      loading: false,
      notFound: false,
    }
    render(<AdminOrderDetailPage />)
    expect(screen.getByText(/EXISTING-TRACK/)).toBeTruthy()
    expect(screen.getByText(/DHL/)).toBeTruthy()
  })
})
