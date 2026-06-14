// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen, fireEvent, cleanup } from '@testing-library/react'
import { en } from '@/lib/i18n/en'
import { SEARCH_DEBOUNCE_MS } from '@/lib/constants'
import type { ProductSearchItem } from '@/lib/types/search'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('next/link', async () => {
  const { createElement } = await import('react')
  return {
    default: ({
      href,
      children,
      onClick,
      className,
    }: {
      href: string
      children: React.ReactNode
      onClick?: () => void
      className?: string
    }) => createElement('a', { href, onClick, className }, children),
  }
})

vi.mock('next/image', async () => {
  const { createElement } = await import('react')
  return {
    default: (props: Record<string, unknown>) => {
      const { fill, priority, unoptimized, sizes, ...rest } = props
      void fill
      void priority
      void unoptimized
      void sizes
      return createElement('img', rest as React.ImgHTMLAttributes<HTMLImageElement>)
    },
  }
})

// Mock next/navigation
const mockReplace = vi.fn()
let mockQ = ''
// When true, searchParams.get('q') returns null (simulates absent ?q= param)
let mockQNull = false
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => ({
    get: (key: string) => {
      if (key !== 'q') return null
      return mockQNull ? null : mockQ
    },
    toString: () => (mockQ && !mockQNull ? `q=${mockQ}` : ''),
  }),
}))

// Mock useApiResource
let mockIndexItems: ProductSearchItem[] = []
// null means useApiResource returns { data: null } — exercises the `indexData?.items ?? []` branch
let mockIndexDataNull = false
let mockCatData: { categories: unknown[] } | null = null

vi.mock('@/hooks/useApiResource', () => ({
  useApiResource: (path: string) => {
    if (path === '/api/products/search-index') {
      const data = mockIndexDataNull ? null : { items: mockIndexItems }
      return { data, loading: false, error: null, notFound: false }
    }
    if (path === '/api/categories') {
      return { data: mockCatData, loading: false, error: null, notFound: false }
    }
    return { data: null, loading: false, error: null, notFound: false }
  },
}))

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function mkItem(
  id: string,
  name: string,
  opts: Partial<ProductSearchItem> = {},
): ProductSearchItem {
  return {
    id,
    name,
    description: null,
    thumbnailUrl: null,
    priceCents: 1000,
    categoryIds: [],
    inStock: true,
    variantLabels: [],
    ...opts,
  }
}

// ─── Component import ─────────────────────────────────────────────────────────

import { GlobalSearchOverlay } from './GlobalSearchOverlay'

function renderOverlay(props: { open?: boolean; onOpenChange?: (v: boolean) => void } = {}) {
  const onOpenChange = props.onOpenChange ?? vi.fn()
  return {
    onOpenChange,
    ...render(<GlobalSearchOverlay open={props.open ?? true} onOpenChange={onOpenChange} />),
  }
}

// Helper: type into the search input and flush React state
function typeQuery(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } })
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  mockIndexItems = []
  mockIndexDataNull = false
  mockCatData = null
  mockQ = ''
  mockQNull = false
  mockReplace.mockReset()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.clearAllMocks()
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GlobalSearchOverlay', () => {
  it('shows startTyping when query is empty and no filters active', () => {
    renderOverlay()
    expect(screen.getByText(en.search.startTyping)).toBeTruthy()
  })

  it('shows noResults when query has no matches', () => {
    // Use a product with a very distinct name and a query with zero similarity
    mockIndexItems = [mkItem('1', 'Laptop')]
    renderOverlay()

    const input = screen.getByRole('searchbox')
    typeQuery(input, 'qqqqqqqqq')

    // noResults shown — deferredQuery should have updated synchronously
    expect(screen.getByText(en.search.noResults)).toBeTruthy()
  })

  it('renders results when query matches', () => {
    mockIndexItems = [mkItem('1', 'Blue Shirt'), mkItem('2', 'Red Hat')]
    renderOverlay()

    typeQuery(screen.getByRole('searchbox'), 'shirt')

    expect(screen.getByText('Blue Shirt')).toBeTruthy()
  })

  it('in-stock toggle shows only in-stock items', () => {
    mockIndexItems = [
      mkItem('1', 'In Stock Item', { inStock: true }),
      mkItem('2', 'Out of Stock Item', { inStock: false }),
    ]
    renderOverlay()

    fireEvent.click(screen.getByRole('checkbox'))

    // Filtered view — out-of-stock item must not appear
    expect(screen.queryByText('Out of Stock Item')).toBeNull()
    expect(screen.getByText('In Stock Item')).toBeTruthy()
  })

  it('clicking a result calls onOpenChange(false)', () => {
    mockIndexItems = [mkItem('p1', 'Test Product')]
    const onOpenChange = vi.fn()
    render(<GlobalSearchOverlay open onOpenChange={onOpenChange} />)

    typeQuery(screen.getByRole('searchbox'), 'test')

    // Find the link — it renders inside a portal; use container querySelector
    const links = document.querySelectorAll('a[href="/product/p1"]')
    expect(links.length).toBeGreaterThan(0)
    fireEvent.click(links[0])

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('clear button resets the query input', () => {
    renderOverlay()
    const input = screen.getByRole('searchbox') as HTMLInputElement

    typeQuery(input, 'hat')
    expect(input.value).toBe('hat')

    fireEvent.click(screen.getByRole('button', { name: en.search.clear }))
    expect(input.value).toBe('')
  })

  it('debounces URL write — router.replace not called before delay', () => {
    renderOverlay()

    typeQuery(screen.getByRole('searchbox'), 'shirt')

    // Still within debounce window
    expect(mockReplace).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS))
    expect(mockReplace).toHaveBeenCalledTimes(1)
  })

  it('shows resultsCount when in-stock filter is active', () => {
    mockIndexItems = [mkItem('1', 'Foo', { inStock: true }), mkItem('2', 'Bar', { inStock: false })]
    renderOverlay()

    fireEvent.click(screen.getByRole('checkbox'))

    // resultsCount = '{count} results' → '1 results'
    expect(screen.getByText(en.search.resultsCount.replace('{count}', '1'))).toBeTruthy()
  })

  it('overlay is not rendered when open=false', () => {
    renderOverlay({ open: false })
    expect(screen.queryByRole('searchbox')).toBeNull()
  })

  it('initializes query from ?q= when open=true at mount', async () => {
    // open=true at mount → open-effect fires and reads live searchParams.get('q')
    mockQ = 'boots'
    await act(async () => {
      renderOverlay({ open: true })
    })
    const input = screen.getByRole('searchbox') as HTMLInputElement
    expect(input.value).toBe('boots')
  })

  it('initializes query to empty string when open=false at mount', () => {
    // open=false → open-effect does not fire; query stays ''
    mockQ = 'ignored'
    renderOverlay({ open: false })
    // Dialog hidden; overlay not rendered when open=false
    expect(screen.queryByRole('searchbox')).toBeNull()
  })

  it('sets query from ?q= when overlay transitions to open', async () => {
    mockQ = 'jacket'
    const { rerender } = renderOverlay({ open: false })
    // Transition open → true triggers the open-effect that reads live searchParams
    await act(async () => {
      rerender(<GlobalSearchOverlay open onOpenChange={vi.fn()} />)
    })
    const input = screen.getByRole('searchbox') as HTMLInputElement
    expect(input.value).toBe('jacket')
  })

  it('sets query to empty string when ?q= is absent and overlay opens', async () => {
    // searchParams.get('q') returns null → ?? '' path in the open-effect
    mockQ = ''
    const { rerender } = renderOverlay({ open: false })
    await act(async () => {
      rerender(<GlobalSearchOverlay open onOpenChange={vi.fn()} />)
    })
    const input = screen.getByRole('searchbox') as HTMLInputElement
    expect(input.value).toBe('')
  })

  it('re-open after ?q= changes reads the new param (stale-ref fix)', async () => {
    // First open with q=shoes, close, then simulate navigation (mock changes q),
    // re-open — must read the new value, not the stale one.
    mockQ = 'shoes'
    const { rerender } = renderOverlay({ open: true })
    await act(async () => {
      rerender(<GlobalSearchOverlay open={false} onOpenChange={vi.fn()} />)
    })
    // Simulate SPA navigation — searchParams now has a different q value
    mockQ = 'boots'
    await act(async () => {
      rerender(<GlobalSearchOverlay open onOpenChange={vi.fn()} />)
    })
    const input = screen.getByRole('searchbox') as HTMLInputElement
    expect(input.value).toBe('boots')
  })

  it('debounce effect returns early (no setTimeout) when open=false', () => {
    // Render with open=false → debounce useEffect hits the !open early return
    renderOverlay({ open: false })
    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS + 100))
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('URL debounce deletes q param when query is cleared', () => {
    mockQ = 'shirt'
    renderOverlay()

    // First type something, then clear it
    const input = screen.getByRole('searchbox')
    typeQuery(input, '')

    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS))
    // Should call replace without q param (query is empty → params.delete('q'))
    expect(mockReplace).toHaveBeenCalledWith('?', { scroll: false })
  })

  it('renders thumbnail image when item.thumbnailUrl is set', () => {
    mockIndexItems = [
      mkItem('p1', 'Sneaker', { thumbnailUrl: 'https://cdn.example.com/sneaker.jpg' }),
    ]
    renderOverlay()

    typeQuery(screen.getByRole('searchbox'), 'sneaker')

    const img = screen.getByRole('img', { name: 'Sneaker' })
    expect(img.getAttribute('src')).toBe('https://cdn.example.com/sneaker.jpg')
  })

  it('renders placeholder icon when item.thumbnailUrl is null', () => {
    mockIndexItems = [mkItem('p1', 'Hat', { thumbnailUrl: null })]
    renderOverlay()

    typeQuery(screen.getByRole('searchbox'), 'hat')

    // No img element in the thumbnail area — the Search icon fallback is rendered
    const imgs = document.querySelectorAll('img')
    expect(imgs.length).toBe(0)
  })

  it('renders item description when present', () => {
    mockIndexItems = [mkItem('p1', 'Boot', { description: 'Waterproof leather boot' })]
    renderOverlay()

    typeQuery(screen.getByRole('searchbox'), 'boot')

    expect(screen.getByText('Waterproof leather boot')).toBeTruthy()
  })

  it('does not render description paragraph when item.description is null', () => {
    mockIndexItems = [mkItem('p1', 'Cap', { description: null })]
    renderOverlay()

    typeQuery(screen.getByRole('searchbox'), 'cap')

    expect(screen.queryByText('null')).toBeNull()
  })

  it('renders category options when catData has categories', () => {
    mockCatData = {
      categories: [
        { id: 'cat1', name: 'Shoes', slug: 'shoes', parentId: null, children: [] },
        { id: 'cat2', name: 'Bags', slug: 'bags', parentId: null, children: [] },
      ],
    }
    renderOverlay()

    const select = screen.getByRole('combobox', { name: en.search.allCategories })
    expect(select).toBeTruthy()
    expect(screen.getByText('Shoes')).toBeTruthy()
    expect(screen.getByText('Bags')).toBeTruthy()
  })

  it('filters by category when category is selected', () => {
    mockCatData = {
      categories: [{ id: 'cat1', name: 'Shoes', slug: 'shoes', parentId: null, children: [] }],
    }
    mockIndexItems = [
      mkItem('p1', 'Nike Shoe', { categoryIds: ['cat1'], inStock: true }),
      mkItem('p2', 'Leather Bag', { categoryIds: ['cat2'], inStock: true }),
    ]
    renderOverlay()

    fireEvent.change(screen.getByRole('combobox', { name: en.search.allCategories }), {
      target: { value: 'cat1' },
    })

    // resultsCount badge is shown when category filter is active
    expect(screen.getByText(en.search.resultsCount.replace('{count}', '1'))).toBeTruthy()
  })

  it('handles null indexData gracefully (items defaults to [])', () => {
    // useApiResource returns { data: null } for search-index → indexData is null
    // This exercises the `indexData?.items ?? []` null-coalesce branch
    mockIndexDataNull = true
    renderOverlay()
    // No crash, shows startTyping state
    expect(screen.getByText(en.search.startTyping)).toBeTruthy()
  })

  it('handles null catData gracefully (categories defaults to [])', () => {
    // catData is null → `catData?.categories ?? []` both in topLevel + filter call
    mockCatData = null
    mockIndexItems = [mkItem('p1', 'Watch')]
    renderOverlay()

    typeQuery(screen.getByRole('searchbox'), 'watch')
    // No crash; result visible
    expect(screen.getByText('Watch')).toBeTruthy()
  })

  it('query defaults to empty string when searchParams.get(q) returns null at mount', async () => {
    // Exercises the `?? ''` fallback in the open-effect: searchParams.get('q') ?? ''
    mockQNull = true
    await act(async () => {
      renderOverlay({ open: true })
    })
    const input = screen.getByRole('searchbox') as HTMLInputElement
    expect(input.value).toBe('')
  })

  it('open-effect sets query to empty string when searchParams.get(q) returns null on open', async () => {
    // Exercises the `?? ''` fallback in the open-effect on a re-open
    mockQNull = true
    const { rerender } = renderOverlay({ open: false })
    await act(async () => {
      rerender(<GlobalSearchOverlay open onOpenChange={vi.fn()} />)
    })
    const input = screen.getByRole('searchbox') as HTMLInputElement
    expect(input.value).toBe('')
  })

  it('results count element has role="status" and aria-live="polite"', () => {
    // a11y: screen readers must be notified of count changes as user types
    mockIndexItems = [mkItem('1', 'Sneaker', { inStock: true })]
    renderOverlay()

    fireEvent.click(screen.getByRole('checkbox'))

    const statusEl = screen.getByRole('status')
    expect(statusEl.getAttribute('aria-live')).toBe('polite')
    expect(statusEl.textContent).toContain('1')
  })

  it('selecting "All categories" resets categoryId to null (|| null branch)', () => {
    // e.target.value is '' when user selects the default option → setCategoryId(null)
    mockCatData = {
      categories: [{ id: 'cat1', name: 'Hats', slug: 'hats', parentId: null, children: [] }],
    }
    mockIndexItems = [mkItem('p1', 'Fedora', { categoryIds: ['cat1'], inStock: true })]
    renderOverlay()

    // First pick a category so filter is active
    fireEvent.change(screen.getByRole('combobox', { name: en.search.allCategories }), {
      target: { value: 'cat1' },
    })
    expect(screen.getByText(en.search.resultsCount.replace('{count}', '1'))).toBeTruthy()

    // Then reset to "All categories" (empty value '' → null)
    fireEvent.change(screen.getByRole('combobox', { name: en.search.allCategories }), {
      target: { value: '' },
    })
    // showEmpty is true again → resultsCount hidden, startTyping shown
    expect(screen.getByText(en.search.startTyping)).toBeTruthy()
  })
})
