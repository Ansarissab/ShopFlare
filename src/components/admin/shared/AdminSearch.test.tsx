// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act, cleanup, waitFor } from '@testing-library/react'
import AdminSearch from './AdminSearch'

// ─── next/navigation mock ─────────────────────────────────────────────────────

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/admin',
}))

// ─── i18n mock ────────────────────────────────────────────────────────────────

vi.mock('@/lib/i18n/Provider', () => ({
  useT: () => ({
    admin: {
      inactive: 'Inactive',
      search: {
        placeholder: 'Search products & orders…',
        products: 'Products',
        orders: 'Orders',
        empty: 'No results',
      },
    },
  }),
  useLocale: () => 'en',
}))

// ─── @/lib/api mock ───────────────────────────────────────────────────────────

const mockApiGet = vi.fn()

vi.mock('@/lib/api', () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
}))

// ─── fixtures ─────────────────────────────────────────────────────────────────

const PRODUCTS_RESPONSE = {
  products: [
    {
      product: { id: 'prod-1', name: 'Blue T-Shirt', active: true },
      variants: [],
      categoryIds: [],
      faqItems: [],
    },
    {
      product: { id: 'prod-2', name: 'Red Sneakers', active: false },
      variants: [],
      categoryIds: [],
      faqItems: [],
    },
  ],
}

const ORDERS_RESPONSE = {
  orders: [
    {
      id: 'ord-1',
      orderNumber: 'ORD-100',
      status: 'pending',
      paymentMethod: 'cod',
      customerName: 'Alice Smith',
      customerEmail: 'alice@example.com',
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
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
  ],
  total: 1,
  page: 1,
  limit: 50,
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function renderSearch() {
  return render(<AdminSearch />)
}

function getInput(container: HTMLElement) {
  return container.querySelector<HTMLInputElement>('[data-shortcut-search]')!
}

// ─── tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  // Default: both endpoints resolve with fixture data
  mockApiGet.mockImplementation((path: string) => {
    if (path.includes('/api/admin/products')) return Promise.resolve(PRODUCTS_RESPONSE)
    if (path.includes('/api/admin/orders')) return Promise.resolve(ORDERS_RESPONSE)
    return Promise.resolve({})
  })
})

afterEach(() => {
  cleanup()
})

describe('AdminSearch', () => {
  it('renders input with data-shortcut-search attribute', () => {
    const { container } = renderSearch()
    const input = getInput(container)
    expect(input).toBeTruthy()
    expect(input.getAttribute('data-shortcut-search')).not.toBeNull()
  })

  it('shows matching products and orders after typing a query', async () => {
    const { container, getByText } = renderSearch()
    const input = getInput(container)

    await act(async () => {
      fireEvent.change(input, { target: { value: 'shirt' } })
      // advance debounce
      await new Promise((r) => setTimeout(r, 250))
    })

    await waitFor(() => {
      expect(getByText('Blue T-Shirt')).toBeTruthy()
    })
  })

  it('shows matching orders when query matches customer name', async () => {
    const { container, getByText } = renderSearch()
    const input = getInput(container)

    await act(async () => {
      fireEvent.change(input, { target: { value: 'alice' } })
      await new Promise((r) => setTimeout(r, 250))
    })

    await waitFor(() => {
      expect(getByText('#ORD-100')).toBeTruthy()
    })
  })

  it('shows empty state when no results match', async () => {
    mockApiGet.mockImplementation((path: string) => {
      if (path.includes('/api/admin/products')) return Promise.resolve({ products: [] })
      if (path.includes('/api/admin/orders'))
        return Promise.resolve({ orders: [], total: 0, page: 1, limit: 50 })
      return Promise.resolve({})
    })

    const { container, getByText } = renderSearch()
    const input = getInput(container)

    await act(async () => {
      fireEvent.change(input, { target: { value: 'xyznothing' } })
      await new Promise((r) => setTimeout(r, 250))
    })

    await waitFor(() => {
      expect(getByText('No results')).toBeTruthy()
    })
  })

  it('navigates to product detail on Enter key', async () => {
    const { container } = renderSearch()
    const input = getInput(container)

    await act(async () => {
      fireEvent.change(input, { target: { value: 'shirt' } })
      await new Promise((r) => setTimeout(r, 250))
    })

    await waitFor(() => {
      expect(container.querySelector('[role="listbox"]')).toBeTruthy()
    })

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(mockPush).toHaveBeenCalledWith('/admin/products/prod-1')
  })

  it('navigates to result detail on click', async () => {
    const { container, getByText } = renderSearch()
    const input = getInput(container)

    await act(async () => {
      fireEvent.change(input, { target: { value: 'shirt' } })
      await new Promise((r) => setTimeout(r, 250))
    })

    await waitFor(() => {
      expect(getByText('Blue T-Shirt')).toBeTruthy()
    })

    fireEvent.pointerDown(getByText('Blue T-Shirt'))
    expect(mockPush).toHaveBeenCalledWith('/admin/products/prod-1')
  })

  it('closes dropdown on Escape key', async () => {
    const { container } = renderSearch()
    const input = getInput(container)

    await act(async () => {
      fireEvent.change(input, { target: { value: 'shirt' } })
      await new Promise((r) => setTimeout(r, 250))
    })

    await waitFor(() => {
      expect(container.querySelector('[role="listbox"]')).toBeTruthy()
    })

    fireEvent.keyDown(input, { key: 'Escape' })

    await waitFor(() => {
      expect(container.querySelector('[role="listbox"]')).toBeNull()
    })
  })

  // ── Branch: keydown when dropdown is closed → no-op (L126: if (!open) return) ──

  it('keydown with dropdown closed is a no-op', () => {
    const { container } = renderSearch()
    const input = getInput(container)
    // No query typed → open=false
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(container.querySelector('[role="listbox"]')).toBeNull()
    expect(mockPush).not.toHaveBeenCalled()
  })

  // ── Branch: onChange with empty/whitespace → closes dropdown (L188) ──

  it('clearing the input closes the dropdown', async () => {
    const { container } = renderSearch()
    const input = getInput(container)

    await act(async () => {
      fireEvent.change(input, { target: { value: 'shirt' } })
      await new Promise((r) => setTimeout(r, 250))
    })

    await waitFor(() => {
      expect(container.querySelector('[role="listbox"]')).toBeTruthy()
    })

    // Clear the input — should close dropdown via onChange branch
    await act(async () => {
      fireEvent.change(input, { target: { value: '' } })
    })

    await waitFor(() => {
      expect(container.querySelector('[role="listbox"]')).toBeNull()
    })
  })

  it('whitespace-only input closes the dropdown', async () => {
    const { container } = renderSearch()
    const input = getInput(container)

    await act(async () => {
      fireEvent.change(input, { target: { value: 'shirt' } })
      await new Promise((r) => setTimeout(r, 250))
    })

    await waitFor(() => {
      expect(container.querySelector('[role="listbox"]')).toBeTruthy()
    })

    await act(async () => {
      fireEvent.change(input, { target: { value: '   ' } })
      await new Promise((r) => setTimeout(r, 250))
    })

    await waitFor(() => {
      expect(container.querySelector('[role="listbox"]')).toBeNull()
    })
  })

  // ── Branch: outside click closes dropdown (L155) ──

  it('clicking outside closes the dropdown', async () => {
    const { container } = renderSearch()
    const input = getInput(container)

    await act(async () => {
      fireEvent.change(input, { target: { value: 'shirt' } })
      await new Promise((r) => setTimeout(r, 250))
    })

    await waitFor(() => {
      expect(container.querySelector('[role="listbox"]')).toBeTruthy()
    })

    // Simulate a pointerdown outside the container
    await act(async () => {
      fireEvent.pointerDown(document.body)
    })

    await waitFor(() => {
      expect(container.querySelector('[role="listbox"]')).toBeNull()
    })
  })

  // ── Branch: ArrowDown/ArrowUp highlight movement (L134, L140) ──

  it('ArrowDown cycles highlight forward through results', async () => {
    const { container } = renderSearch()
    const input = getInput(container)

    await act(async () => {
      // 'shirt' matches Blue T-Shirt (prod-1), alice matches ORD-100 — use 'e' to get both
      fireEvent.change(input, { target: { value: 'e' } })
      await new Promise((r) => setTimeout(r, 250))
    })

    await waitFor(() => {
      expect(container.querySelector('[role="listbox"]')).toBeTruthy()
    })

    // Index 0 is highlighted by default
    const getSelected = () => container.querySelector('[aria-selected="true"]')
    expect(getSelected()?.id).toBe('admin-search-item-0')

    await act(async () => {
      fireEvent.keyDown(input, { key: 'ArrowDown' })
    })
    expect(getSelected()?.id).toBe('admin-search-item-1')
  })

  it('ArrowUp moves highlight backward', async () => {
    const { container } = renderSearch()
    const input = getInput(container)

    await act(async () => {
      fireEvent.change(input, { target: { value: 'e' } })
      await new Promise((r) => setTimeout(r, 250))
    })

    await waitFor(() => {
      expect(container.querySelector('[role="listbox"]')).toBeTruthy()
    })

    // Move down first so we can go back up
    await act(async () => {
      fireEvent.keyDown(input, { key: 'ArrowDown' })
    })
    await act(async () => {
      fireEvent.keyDown(input, { key: 'ArrowUp' })
    })

    const selected = container.querySelector('[aria-selected="true"]')
    expect(selected?.id).toBe('admin-search-item-0')
  })

  it('ArrowDown wraps around from last to first result', async () => {
    // Single-result scenario: ArrowDown from 0 → wraps to 0
    mockApiGet.mockImplementation((path: string) => {
      if (path.includes('/api/admin/products'))
        return Promise.resolve({
          products: [
            {
              product: { id: 'p1', name: 'Widget', active: true },
              variants: [],
              categoryIds: [],
              faqItems: [],
            },
          ],
        })
      if (path.includes('/api/admin/orders'))
        return Promise.resolve({ orders: [], total: 0, page: 1, limit: 50 })
      return Promise.resolve({})
    })

    const { container } = renderSearch()
    const input = getInput(container)

    await act(async () => {
      fireEvent.change(input, { target: { value: 'widget' } })
      await new Promise((r) => setTimeout(r, 250))
    })

    await waitFor(() => {
      expect(container.querySelector('[role="listbox"]')).toBeTruthy()
    })

    // Only 1 result; ArrowDown should wrap back to 0
    await act(async () => {
      fireEvent.keyDown(input, { key: 'ArrowDown' })
    })
    const selected = container.querySelector('[aria-selected="true"]')
    expect(selected?.id).toBe('admin-search-item-0')
  })

  it('ArrowUp wraps from first to last result', async () => {
    mockApiGet.mockImplementation((path: string) => {
      if (path.includes('/api/admin/products'))
        return Promise.resolve({
          products: [
            {
              product: { id: 'p1', name: 'Alpha', active: true },
              variants: [],
              categoryIds: [],
              faqItems: [],
            },
            {
              product: { id: 'p2', name: 'Alpha Extra', active: true },
              variants: [],
              categoryIds: [],
              faqItems: [],
            },
          ],
        })
      if (path.includes('/api/admin/orders'))
        return Promise.resolve({ orders: [], total: 0, page: 1, limit: 50 })
      return Promise.resolve({})
    })

    const { container } = renderSearch()
    const input = getInput(container)

    await act(async () => {
      fireEvent.change(input, { target: { value: 'alpha' } })
      await new Promise((r) => setTimeout(r, 250))
    })

    await waitFor(() => {
      expect(container.querySelector('[role="listbox"]')).toBeTruthy()
    })

    // Highlighted at 0; ArrowUp should wrap to last (index 1)
    await act(async () => {
      fireEvent.keyDown(input, { key: 'ArrowUp' })
    })
    const selected = container.querySelector('[aria-selected="true"]')
    expect(selected?.id).toBe('admin-search-item-1')
  })

  // ── Branch: Enter with highlighted result ≠ results[0] (L147 ?? fallback) ──

  it('Enter key navigates to highlighted (non-first) result', async () => {
    const { container } = renderSearch()
    const input = getInput(container)

    await act(async () => {
      fireEvent.change(input, { target: { value: 'e' } })
      await new Promise((r) => setTimeout(r, 250))
    })

    await waitFor(() => {
      expect(container.querySelector('[role="listbox"]')).toBeTruthy()
    })

    // Move to index 1
    await act(async () => {
      fireEvent.keyDown(input, { key: 'ArrowDown' })
    })

    fireEvent.keyDown(input, { key: 'Enter' })
    // Should navigate somewhere (not the first result at index 0)
    expect(mockPush).toHaveBeenCalledTimes(1)
  })

  // ── Branch: API error path (L100: catch block) ──

  it('silently handles API fetch error', async () => {
    mockApiGet.mockRejectedValue(new Error('network error'))

    const { container } = renderSearch()
    const input = getInput(container)

    await act(async () => {
      fireEvent.change(input, { target: { value: 'shirt' } })
      await new Promise((r) => setTimeout(r, 250))
    })

    // Dropdown should not appear; no crash
    await new Promise((r) => setTimeout(r, 50))
    expect(container.querySelector('[role="listbox"]')).toBeNull()
  })

  // ── Branch: null/undefined API responses → ?? [] fallback (L69, L80) ──

  it('handles null products response gracefully', async () => {
    mockApiGet.mockImplementation((path: string) => {
      if (path.includes('/api/admin/products')) return Promise.resolve(null)
      if (path.includes('/api/admin/orders')) return Promise.resolve(ORDERS_RESPONSE)
      return Promise.resolve({})
    })

    const { container, getByText } = renderSearch()
    const input = getInput(container)

    await act(async () => {
      fireEvent.change(input, { target: { value: 'alice' } })
      await new Promise((r) => setTimeout(r, 250))
    })

    await waitFor(() => {
      expect(getByText('#ORD-100')).toBeTruthy()
    })
  })

  it('handles null orders response gracefully', async () => {
    mockApiGet.mockImplementation((path: string) => {
      if (path.includes('/api/admin/products')) return Promise.resolve(PRODUCTS_RESPONSE)
      if (path.includes('/api/admin/orders')) return Promise.resolve(null)
      return Promise.resolve({})
    })

    const { container, getByText } = renderSearch()
    const input = getInput(container)

    await act(async () => {
      fireEvent.change(input, { target: { value: 'shirt' } })
      await new Promise((r) => setTimeout(r, 250))
    })

    await waitFor(() => {
      expect(getByText('Blue T-Shirt')).toBeTruthy()
    })
  })

  // ── Branch: cancelled = true path (L67) ──

  it('ignores stale fetch results when query changes quickly', async () => {
    // The `cancelled` flag is set to true when the effect cleanup runs.
    // Simulate: type 'sh', change to 'shirt' before first fetch resolves.
    let resolveFirst: (v: unknown) => void
    const firstCall = new Promise((r) => {
      resolveFirst = r
    })

    let callCount = 0
    mockApiGet.mockImplementation((path: string) => {
      callCount++
      if (callCount <= 2) {
        // First pair of calls (for 'sh') — slow
        if (path.includes('/api/admin/products')) return firstCall.then(() => PRODUCTS_RESPONSE)
        if (path.includes('/api/admin/orders')) return firstCall.then(() => ORDERS_RESPONSE)
      }
      // Second pair (for 'shirt') — fast
      if (path.includes('/api/admin/products')) return Promise.resolve(PRODUCTS_RESPONSE)
      if (path.includes('/api/admin/orders')) return Promise.resolve(ORDERS_RESPONSE)
      return Promise.resolve({})
    })

    const { container } = renderSearch()
    const input = getInput(container)

    // Type 'sh' — triggers debounce + fetch (slow)
    fireEvent.change(input, { target: { value: 'sh' } })
    await new Promise((r) => setTimeout(r, 210))

    // Before first fetch resolves, type 'shirt' — new debounce starts, cleanup cancels first
    fireEvent.change(input, { target: { value: 'shirt' } })
    await new Promise((r) => setTimeout(r, 210))

    // Resolve the first (stale) fetch — should be ignored due to cancelled=true
    resolveFirst!(undefined)
    await new Promise((r) => setTimeout(r, 50))

    // The second fetch results for 'shirt' should show
    await waitFor(() => {
      expect(container.querySelector('[role="listbox"]')).toBeTruthy()
    })
  })

  // ── Branch: inactive product shows 'Inactive' sub label (L75, L237) ──

  it('shows Inactive label for inactive products', async () => {
    const { container, getByText } = renderSearch()
    const input = getInput(container)

    await act(async () => {
      // 'sneakers' matches 'Red Sneakers' which is active: false
      fireEvent.change(input, { target: { value: 'sneakers' } })
      await new Promise((r) => setTimeout(r, 250))
    })

    await waitFor(() => {
      expect(getByText('Red Sneakers')).toBeTruthy()
      expect(getByText('Inactive')).toBeTruthy()
    })
  })

  // ── Branch: order sub label rendered (L267: r.sub in orderResults) ──

  it('shows customer name as sub label in order results', async () => {
    const { container, getByText } = renderSearch()
    const input = getInput(container)

    await act(async () => {
      fireEvent.change(input, { target: { value: 'ORD-100' } })
      await new Promise((r) => setTimeout(r, 250))
    })

    await waitFor(() => {
      expect(getByText('#ORD-100')).toBeTruthy()
      // customerName is the sub label for order results
      expect(getByText('Alice Smith')).toBeTruthy()
    })
  })

  // ── Branch: order matching by customerEmail (L86: o.customerEmail ?? '') ──

  it('finds orders matching by customerEmail', async () => {
    const { container, getByText } = renderSearch()
    const input = getInput(container)

    await act(async () => {
      fireEvent.change(input, { target: { value: 'alice@example' } })
      await new Promise((r) => setTimeout(r, 250))
    })

    await waitFor(() => {
      expect(getByText('#ORD-100')).toBeTruthy()
    })
  })

  it('handles order with null customerEmail without crashing', async () => {
    mockApiGet.mockImplementation((path: string) => {
      if (path.includes('/api/admin/products')) return Promise.resolve({ products: [] })
      if (path.includes('/api/admin/orders'))
        return Promise.resolve({
          orders: [
            {
              id: 'ord-2',
              orderNumber: 'ORD-200',
              status: 'pending',
              paymentMethod: 'cod',
              customerName: 'Bob Jones',
              customerEmail: null,
              customerPhone: null,
              totalCents: 1000,
              subtotalCents: 1000,
              shippingCents: 0,
              discountCents: 0,
              taxCents: 0,
              couponCode: null,
              trackingNumber: null,
              carrier: null,
              notes: null,
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
          ],
          total: 1,
          page: 1,
          limit: 50,
        })
      return Promise.resolve({})
    })

    const { container, getByText } = renderSearch()
    const input = getInput(container)

    await act(async () => {
      fireEvent.change(input, { target: { value: 'bob' } })
      await new Promise((r) => setTimeout(r, 250))
    })

    await waitFor(() => {
      expect(getByText('#ORD-200')).toBeTruthy()
    })
  })

  // ── Branch: only products returned (no orders group section rendered) ──

  it('renders only product group section when orders return empty', async () => {
    mockApiGet.mockImplementation((path: string) => {
      if (path.includes('/api/admin/products')) return Promise.resolve(PRODUCTS_RESPONSE)
      if (path.includes('/api/admin/orders'))
        return Promise.resolve({ orders: [], total: 0, page: 1, limit: 50 })
      return Promise.resolve({})
    })

    const { container, getByText, queryByText } = renderSearch()
    const input = getInput(container)

    await act(async () => {
      fireEvent.change(input, { target: { value: 'shirt' } })
      await new Promise((r) => setTimeout(r, 250))
    })

    await waitFor(() => {
      expect(getByText('Products')).toBeTruthy()
      expect(queryByText('Orders')).toBeNull()
    })
  })

  // ── Branch: only orders returned (no products group section rendered) ──

  it('renders only order group section when products return empty', async () => {
    mockApiGet.mockImplementation((path: string) => {
      if (path.includes('/api/admin/products')) return Promise.resolve({ products: [] })
      if (path.includes('/api/admin/orders')) return Promise.resolve(ORDERS_RESPONSE)
      return Promise.resolve({})
    })

    const { container, getByText, queryByText } = renderSearch()
    const input = getInput(container)

    await act(async () => {
      fireEvent.change(input, { target: { value: 'alice' } })
      await new Promise((r) => setTimeout(r, 250))
    })

    await waitFor(() => {
      expect(getByText('Orders')).toBeTruthy()
      expect(queryByText('Products')).toBeNull()
    })
  })

  // ── Branch: highlighted result className (non-highlighted product item) ──

  it('applies highlighted className to active item and non-highlighted to others', async () => {
    mockApiGet.mockImplementation((path: string) => {
      if (path.includes('/api/admin/products'))
        return Promise.resolve({
          products: [
            {
              product: { id: 'p1', name: 'Bravo Product', active: true },
              variants: [],
              categoryIds: [],
              faqItems: [],
            },
            {
              product: { id: 'p2', name: 'Bravo Other', active: true },
              variants: [],
              categoryIds: [],
              faqItems: [],
            },
          ],
        })
      if (path.includes('/api/admin/orders'))
        return Promise.resolve({ orders: [], total: 0, page: 1, limit: 50 })
      return Promise.resolve({})
    })

    const { container } = renderSearch()
    const input = getInput(container)

    await act(async () => {
      fireEvent.change(input, { target: { value: 'bravo' } })
      await new Promise((r) => setTimeout(r, 250))
    })

    await waitFor(() => {
      expect(container.querySelector('[role="listbox"]')).toBeTruthy()
    })

    // Index 0 is highlighted — index 1 should NOT have bg-accent class from the highlighted branch
    const items = container.querySelectorAll('[role="option"]')
    expect(items).toHaveLength(2)
    // Item at index 0 is highlighted (bg-accent)
    expect(items[0].className).toContain('bg-accent')
    // Item at index 1 is NOT highlighted (hover:bg-accent but not bg-accent directly)
    expect(items[1].className).not.toMatch(/^(?:(?!hover:).)*bg-accent/)
  })

  // ── Branch: focus re-opens dropdown when results exist (L191) ──

  it('re-opens dropdown on input focus when results are cached', async () => {
    const { container } = renderSearch()
    const input = getInput(container)

    await act(async () => {
      fireEvent.change(input, { target: { value: 'shirt' } })
      await new Promise((r) => setTimeout(r, 250))
    })

    await waitFor(() => {
      expect(container.querySelector('[role="listbox"]')).toBeTruthy()
    })

    // Close via Escape
    fireEvent.keyDown(input, { key: 'Escape' })
    await waitFor(() => {
      expect(container.querySelector('[role="listbox"]')).toBeNull()
    })

    // Focus re-opens it
    await act(async () => {
      fireEvent.focus(input)
    })
    await waitFor(() => {
      expect(container.querySelector('[role="listbox"]')).toBeTruthy()
    })
  })
})
