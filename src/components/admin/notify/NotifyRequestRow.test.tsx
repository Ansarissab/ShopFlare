// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { NotifyRequestRow } from './NotifyRequestRow'
import { en } from '@/lib/i18n/en'
import type { NotifyRequest } from '@/lib/types/admin'

function makeRequest(overrides: Partial<NotifyRequest> = {}): NotifyRequest {
  return {
    sizeOptionId: 'size-1',
    size: 'M',
    productName: 'Blue Hoodie',
    variantLabel: 'Blue',
    waiting: 3,
    lastRequestedAt: '2026-01-15T00:00:00Z',
    inStock: false,
    ...overrides,
  }
}

afterEach(() => cleanup())

describe('NotifyRequestRow', () => {
  it('renders product name, variant label and size', () => {
    render(<NotifyRequestRow request={makeRequest()} />)
    expect(screen.getByText('Blue Hoodie')).toBeTruthy()
    expect(screen.getByText(`Blue — ${en.admin.notifySize}: M`)).toBeTruthy()
  })

  it('renders waiting count via interpolated string', () => {
    render(<NotifyRequestRow request={makeRequest({ waiting: 7 })} />)
    expect(screen.getByText(en.admin.notifyRequestsFor.replace('{count}', '7'))).toBeTruthy()
  })

  it('renders out-of-stock badge when not in stock', () => {
    render(<NotifyRequestRow request={makeRequest({ inStock: false })} />)
    expect(screen.getByText(en.admin.notifyOutOfStock)).toBeTruthy()
    expect(screen.queryByText(en.admin.notifyInStock)).toBeNull()
  })

  it('renders in-stock badge when in stock', () => {
    render(<NotifyRequestRow request={makeRequest({ inStock: true })} />)
    expect(screen.getByText(en.admin.notifyInStock)).toBeTruthy()
    expect(screen.queryByText(en.admin.notifyOutOfStock)).toBeNull()
  })

  it('renders the requested-at label', () => {
    render(<NotifyRequestRow request={makeRequest()} />)
    expect(screen.getByText(new RegExp(en.admin.notifyRequestedAt))).toBeTruthy()
  })
})
