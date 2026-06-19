// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { useProductSearch } from './useProductSearch'
import type { ProductWithVariants } from '@/lib/types/product'
import type { CategoryNode } from '@/lib/types/category'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function makeProduct(id: string, name: string, categoryIds: string[] = []): ProductWithVariants {
  return {
    product: {
      id,
      name,
      slug: id,
      description: `${name} description`,
      basePriceCents: 1000,
      currency: 'USD',
      isActive: true,
    } as unknown as ProductWithVariants['product'],
    variants: [
      {
        id: `${id}-v1`,
        label: `${name} variant`,
        images: [],
        sizes: [],
      } as unknown as ProductWithVariants['variants'][number],
    ],
    categoryIds,
    faqItems: [],
  }
}

function makeCategory(id: string, children: CategoryNode[] = []): CategoryNode {
  return {
    id,
    name: id,
    slug: id,
    productCount: 0,
    children,
  } as unknown as CategoryNode
}

describe('useProductSearch', () => {
  const items = [
    makeProduct('p1', 'Red Shirt', ['cat-tops']),
    makeProduct('p2', 'Blue Shirt', ['cat-tops']),
    makeProduct('p3', 'Green Hat', ['cat-hats']),
    makeProduct('p4', 'Yellow Hat', ['cat-hats']),
    makeProduct('p5', 'Black Boots', ['cat-shoes']),
  ]

  it('returns the first page and reports hasMore when more remain', () => {
    const { result } = renderHook(() =>
      useProductSearch({
        items,
        pageSize: 2,
        query: '',
        activeCategoryId: null,
        allCategories: [],
      }),
    )
    expect(result.current.visibleItems).toHaveLength(2)
    expect(result.current.hasMore).toBe(true)
    expect(result.current.totalFiltered).toBe(5)
    expect(result.current.isLoadingMore).toBe(false)
  })

  it('loadMore appends the next page and clears hasMore at the end', () => {
    const { result } = renderHook(() =>
      useProductSearch({
        items,
        pageSize: 2,
        query: '',
        activeCategoryId: null,
        allCategories: [],
      }),
    )
    act(() => result.current.loadMore())
    expect(result.current.visibleItems).toHaveLength(4)
    expect(result.current.hasMore).toBe(true)

    act(() => result.current.loadMore())
    expect(result.current.visibleItems).toHaveLength(5)
    expect(result.current.hasMore).toBe(false)
  })

  it('loadMore is a no-op once hasMore is false', () => {
    const { result } = renderHook(() =>
      useProductSearch({
        items,
        pageSize: 10,
        query: '',
        activeCategoryId: null,
        allCategories: [],
      }),
    )
    expect(result.current.hasMore).toBe(false)
    act(() => result.current.loadMore())
    expect(result.current.visibleItems).toHaveLength(5)
    expect(result.current.hasMore).toBe(false)
  })

  it('empty query: no Fuse loaded, returns all items (pure category path)', () => {
    const { result } = renderHook(() =>
      useProductSearch({
        items,
        pageSize: 10,
        query: '',
        activeCategoryId: null,
        allCategories: [],
      }),
    )
    // All items shown, no fuzzy filtering
    expect(result.current.totalFiltered).toBe(5)
  })

  it('filters by fuzzy query (lazy Fuse loaded on non-empty query)', async () => {
    const { result } = renderHook(() =>
      useProductSearch({
        items,
        pageSize: 10,
        query: 'shirt',
        activeCategoryId: null,
        allCategories: [],
      }),
    )

    // Wait for the dynamic import of productFuse to resolve and fuse to build
    await waitFor(() => {
      const names = result.current.visibleItems.map((i) => i.product.name)
      expect(names).toContain('Red Shirt')
      expect(names).toContain('Blue Shirt')
      expect(names).not.toContain('Green Hat')
    })
  })

  it('filters by active category (descendants) without Fuse', () => {
    const tree: CategoryNode[] = [makeCategory('cat-hats')]
    const { result } = renderHook(() =>
      useProductSearch({
        items,
        pageSize: 10,
        query: '',
        activeCategoryId: 'cat-hats',
        allCategories: tree,
      }),
    )
    const ids = result.current.visibleItems.map((i) => i.product.id).sort()
    expect(ids).toEqual(['p3', 'p4'])
  })

  it('matches products tagged on a child category via the parent', () => {
    const tree: CategoryNode[] = [
      makeCategory('cat-root', [makeCategory('cat-tops'), makeCategory('cat-hats')]),
    ]
    const { result } = renderHook(() =>
      useProductSearch({
        items,
        pageSize: 10,
        query: '',
        activeCategoryId: 'cat-root',
        allCategories: tree,
      }),
    )
    const ids = result.current.visibleItems.map((i) => i.product.id).sort()
    // p1,p2 (tops) + p3,p4 (hats); p5 (shoes) excluded.
    expect(ids).toEqual(['p1', 'p2', 'p3', 'p4'])
  })

  it('resets to page 1 when the query changes', async () => {
    const { result, rerender } = renderHook((props) => useProductSearch(props), {
      initialProps: {
        items,
        pageSize: 2,
        query: '',
        activeCategoryId: null as string | null,
        allCategories: [] as CategoryNode[],
      },
    })
    // Advance to page 2.
    act(() => result.current.loadMore())
    expect(result.current.visibleItems).toHaveLength(4)

    // Changing the query must snap pagination back to page 1.
    rerender({
      items,
      pageSize: 2,
      query: 'shirt',
      activeCategoryId: null,
      allCategories: [],
    })

    // After rerender, page resets immediately to 1 (the prevFilterKey check fires during render).
    // Fuse may not be loaded yet → shows category-filtered slice (length 2 = page 1 of all items).
    expect(result.current.visibleItems).toHaveLength(2)

    // Once Fuse loads, still page 1 — now narrowed to shirt results.
    await waitFor(() => {
      expect(result.current.visibleItems).toHaveLength(2) // Red Shirt + Blue Shirt, page 1
    })
  })

  it('resets to page 1 when the active category changes', () => {
    const tree: CategoryNode[] = [makeCategory('cat-tops'), makeCategory('cat-hats')]
    const { result, rerender } = renderHook((props) => useProductSearch(props), {
      initialProps: {
        items,
        pageSize: 1,
        query: '',
        activeCategoryId: null as string | null,
        allCategories: tree,
      },
    })
    act(() => result.current.loadMore())
    expect(result.current.visibleItems).toHaveLength(2)

    rerender({
      items,
      pageSize: 1,
      query: '',
      activeCategoryId: 'cat-hats',
      allCategories: tree,
    })
    expect(result.current.visibleItems).toHaveLength(1)
  })

  it('fuzzy query + category: AND narrows results', async () => {
    const tree: CategoryNode[] = [makeCategory('cat-tops'), makeCategory('cat-hats')]
    const { result } = renderHook(() =>
      useProductSearch({
        items,
        pageSize: 10,
        query: 'shirt',
        activeCategoryId: 'cat-tops',
        allCategories: tree,
      }),
    )

    // After Fuse loads: shirt matches p1+p2 (tops) — hats excluded by category filter.
    await waitFor(() => {
      const ids = result.current.visibleItems.map((i) => i.product.id).sort()
      expect(ids).toEqual(['p1', 'p2'])
    })
  })
})
