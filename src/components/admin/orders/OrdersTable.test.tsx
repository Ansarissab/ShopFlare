// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { OrdersTable } from './OrdersTable'
import { en } from '@/lib/i18n/en'
import { formatPrice, formatDate } from '@/lib/utils/index'
import type { AdminOrder } from '@/lib/types/admin'

vi.mock('next/link', async () => {
  const { createElement } = await import('react')
  return {
    default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
      createElement('a', { href, ...rest }, children),
  }
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function makeOrder(overrides: Partial<AdminOrder> = {}): AdminOrder {
  return {
    id: 'ord-1',
    orderNumber: 'SF-1001',
    status: 'pending',
    paymentMethod: 'cod',
    customerName: 'Jane Doe',
    customerEmail: 'jane@example.com',
    customerPhone: '+1 555 0100',
    totalCents: 5000,
    subtotalCents: 4700,
    shippingCents: 300,
    discountCents: 0,
    taxCents: 0,
    couponCode: null,
    trackingNumber: null,
    carrier: null,
    notes: null,
    createdAt: '2026-01-15T10:00:00.000Z',
    updatedAt: '2026-01-15T10:00:00.000Z',
    ...overrides,
  }
}

describe('OrdersTable', () => {
  it('renders empty state when there are no orders', () => {
    render(<OrdersTable orders={[]} />)
    expect(screen.getByText('No orders found.')).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('renders a row linking to the order detail by order number', () => {
    const order = makeOrder()
    render(<OrdersTable orders={[order]} />)
    const link = screen.getByRole('link', { name: 'SF-1001' })
    expect(link.getAttribute('href')).toBe('/admin/orders/ord-1')
  })

  it('renders customer name and email', () => {
    render(<OrdersTable orders={[makeOrder()]} />)
    expect(screen.getByText('Jane Doe')).toBeTruthy()
    expect(screen.getByText('jane@example.com')).toBeTruthy()
  })

  it('falls back to phone when email is null', () => {
    render(<OrdersTable orders={[makeOrder({ customerEmail: null })]} />)
    expect(screen.getByText('+1 555 0100')).toBeTruthy()
  })

  it('falls back to em dash when both email and phone are null', () => {
    render(<OrdersTable orders={[makeOrder({ customerEmail: null, customerPhone: null })]} />)
    expect(screen.getByText('—')).toBeTruthy()
  })

  it('maps a known payment method to its label', () => {
    render(<OrdersTable orders={[makeOrder({ paymentMethod: 'cod' })]} />)
    expect(screen.getByText(en.paymentMethodLabels.cod)).toBeTruthy()
  })

  it('falls back to the raw payment method when unknown', () => {
    render(<OrdersTable orders={[makeOrder({ paymentMethod: 'bitcoin' })]} />)
    expect(screen.getByText('bitcoin')).toBeTruthy()
  })

  it('maps a known status to its label', () => {
    render(<OrdersTable orders={[makeOrder({ status: 'shipped' })]} />)
    expect(screen.getByText(en.orderStatusLabels.shipped)).toBeTruthy()
  })

  it('falls back to the raw status when it has no label mapping', () => {
    // @ts-expect-error testing the runtime fallback branch with an unmapped status
    render(<OrdersTable orders={[makeOrder({ status: 'refunded' })]} />)
    expect(screen.getByText('refunded')).toBeTruthy()
  })

  it('formats total and date', () => {
    const order = makeOrder()
    render(<OrdersTable orders={[order]} />)
    expect(screen.getByText(formatPrice(order.totalCents))).toBeTruthy()
    expect(screen.getByText(formatDate(order.createdAt))).toBeTruthy()
  })

  it('renders one row per order', () => {
    render(
      <OrdersTable
        orders={[
          makeOrder({ id: 'a', orderNumber: 'SF-1' }),
          makeOrder({ id: 'b', orderNumber: 'SF-2' }),
        ]}
      />,
    )
    expect(screen.getByRole('link', { name: 'SF-1' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'SF-2' })).toBeTruthy()
  })
})
