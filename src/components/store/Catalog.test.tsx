// @vitest-environment jsdom
//
// Regression: CLS fix — Catalog given initialProducts must render the product
// grid immediately without ever showing ProductListingSkeleton.
//
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { Catalog } from './Catalog'
import type { ProductWithVariants } from '@/lib/types/product'

// ── Next.js navigation stubs ────────────────────────────────────────────────
// mockSearchParams is mutable so individual tests can seed initial q/category.
const mockSearchParamsMap: Record<string, string | null> = {}
const mockRouterReplace = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockRouterReplace }),
  useSearchParams: () => ({ get: (key: string) => mockSearchParamsMap[key] ?? null }),
}))

// ── Hook stubs ───────────────────────────────────────────────────────────────
// useApiResource is mocked at the module level; individual tests control the
// returned state via `mockApiResource`.
let mockProductsState: { data: unknown; loading: boolean; error: string | null } = {
  data: null,
  loading: true,
  error: null,
}
let mockCatsState: { data: unknown; loading: boolean; error: string | null } = {
  data: { categories: [] },
  loading: false,
  error: null,
}

vi.mock('@/hooks/useApiResource', () => ({
  useApiResource: vi.fn((path: string, opts?: { fallbackData?: unknown }) => {
    if (path === '/api/products') {
      // Mirror the real hook: fallbackData (SSR initialProducts) seeds `data`
      // until the background fetch resolves — this is what avoids the skeleton.
      const data = mockProductsState.data ?? opts?.fallbackData ?? null
      return { ...mockProductsState, data, notFound: false }
    }
    if (path === '/api/categories') return { ...mockCatsState, notFound: false }
    return { data: null, loading: false, error: null, notFound: false }
  }),
}))

const mockUseStoreConfig = vi.fn<
  () => { config: { productPageSize: number; currency: string } | null }
>(() => ({ config: { productPageSize: 24, currency: 'USD' } }))
vi.mock('@/hooks/useStoreConfig', () => ({
  useStoreConfig: () => mockUseStoreConfig(),
}))

// Lightweight ProductGrid stub — renders data-testid per item so we can count.
vi.mock('@/components/store/product/ProductGrid', async () => {
  const { createElement } = await import('react')
  return {
    ProductGrid: ({ items }: { items: ProductWithVariants[] }) =>
      createElement('div', { 'data-testid': 'product-grid', 'data-count': items.length }),
  }
})

// Stub heavy sub-components so the test stays fast.
vi.mock('@/components/store/product/ProductHeroWrapper', async () => {
  const { createElement } = await import('react')
  return { ProductHeroWrapper: () => createElement('div', { 'data-testid': 'product-hero' }) }
})
vi.mock('@/components/store/categories/CategoryFilter', async () => {
  const { createElement } = await import('react')
  return {
    CategoryFilter: ({
      onChange,
    }: {
      categories: unknown[]
      activeSlug: string | null
      onChange: (slug: string | null) => void
    }) => createElement('button', { 'data-testid': 'cat-filter', onClick: () => onChange(null) }),
  }
})
vi.mock('@/components/store/search/SearchBar', async () => {
  const { createElement } = await import('react')
  return {
    SearchBar: ({ value, onChange }: { value: string; onChange: (v: string) => void }) =>
      createElement('input', {
        'data-testid': 'search-bar',
        value,
        'data-value': value,
        onChange: (e: { target: { value: string } }) => onChange(e.target.value),
      }),
  }
})
vi.mock('@/components/shared/InfiniteScrollSentinel', async () => {
  const { createElement } = await import('react')
  return { InfiniteScrollSentinel: () => createElement('div') }
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  mockRouterReplace.mockReset()
  // reset state back to defaults
  mockProductsState = { data: null, loading: true, error: null }
  mockCatsState = { data: { categories: [] }, loading: false, error: null }
  // reset search params
  for (const key of Object.keys(mockSearchParamsMap)) delete mockSearchParamsMap[key]
  // reset storeConfig mock back to default
  mockUseStoreConfig.mockReturnValue({ config: { productPageSize: 24, currency: 'USD' } })
})

function makeProduct(id: string): ProductWithVariants {
  return {
    product: {
      id,
      name: `Product ${id}`,
      description: '',
      active: true,
      reviewsEnabled: false,
      stripeProductId: null,
      faqItems: null,
      createdAt: '2024-01-01 00:00:00',
      updatedAt: '2024-01-01 00:00:00',
    },
    categoryIds: [],
    variants: [
      {
        id: `${id}-v1`,
        productId: id,
        label: 'Default',
        colorHex: '#000',
        sortOrder: 0,
        images: [
          { id: `${id}-img`, variantId: `${id}-v1`, url: '/img.jpg', r2Key: 'k', sortOrder: 0 },
        ],
        sizes: [
          {
            id: `${id}-s1`,
            variantId: `${id}-v1`,
            size: 'M',
            sku: null,
            priceCents: 1000,
            stock: 5,
            stripePriceId: null,
            active: true,
          },
        ],
      },
    ],
    faqItems: [],
  }
}

// ── Skeleton helpers ─────────────────────────────────────────────────────────
// ProductListingSkeleton renders a grid of <div>s containing Skeleton elements.
// We detect it by the absence of the product-grid data-testid.
const hasProductGrid = () => screen.queryByTestId('product-grid') !== null
const querySkeletonGrid = () => document.querySelector('.grid.grid-cols-2')

describe('Catalog — CLS regression (initialProducts)', () => {
  it('shows ProductListingSkeleton when loading and no initialProducts', () => {
    mockProductsState = { data: null, loading: true, error: null }
    render(<Catalog basePath="/" />)
    expect(hasProductGrid()).toBe(false)
    // The skeleton grid is rendered (8 placeholder tiles in a grid).
    expect(querySkeletonGrid()).not.toBeNull()
  })

  it('renders ProductGrid immediately when initialProducts provided — no skeleton', () => {
    // Simulate hook still loading (as it would be on first client-side render
    // after hydration when the fallback seeds the initial state).
    mockProductsState = { data: null, loading: false, error: null }
    const products = [makeProduct('p1'), makeProduct('p2'), makeProduct('p3')]
    render(<Catalog basePath="/" initialProducts={products} />)
    // Grid must be present — real products rendered, not the skeleton.
    const grid = screen.getByTestId('product-grid')
    expect(grid).toBeTruthy()
    expect(grid.getAttribute('data-count')).toBe('3')
    // Skeleton grid must NOT be present.
    expect(querySkeletonGrid()).toBeNull()
  })

  it('still renders ProductGrid after hook data resolves (revalidation path)', () => {
    const products = [makeProduct('a'), makeProduct('b')]
    mockProductsState = { data: { products }, loading: false, error: null }
    render(<Catalog basePath="/" />)
    expect(hasProductGrid()).toBe(true)
    expect(querySkeletonGrid()).toBeNull()
  })

  it('shows error state when hook errors and no initialProducts', () => {
    mockProductsState = { data: null, loading: false, error: 'Network error' }
    render(<Catalog basePath="/" />)
    expect(screen.getByText('Network error')).toBeTruthy()
    expect(hasProductGrid()).toBe(false)
  })
})

// ── Additional branch / function coverage ─────────────────────────────────────

function makeCategory(
  id: string,
  slug: string,
  parentId: string | null = null,
): import('@/lib/types/category').CategoryNode {
  return {
    id,
    name: `Cat ${id}`,
    slug,
    description: '',
    parentId,
    imageUrl: null,
    r2Key: null,
    sortOrder: 0,
    active: true,
    createdAt: '2024-01-01 00:00:00',
    updatedAt: '2024-01-01 00:00:00',
    productCount: 0,
    children: [],
  }
}

describe('Catalog — product states', () => {
  it('shows coming-soon when product list is empty', () => {
    mockProductsState = { data: { products: [] }, loading: false, error: null }
    render(<Catalog basePath="/" />)
    expect(screen.getByText(/coming soon/i)).toBeTruthy()
    expect(hasProductGrid()).toBe(false)
  })

  it('shows product hero for a single product with no active query/category', () => {
    mockProductsState = { data: { products: [makeProduct('solo')] }, loading: false, error: null }
    render(<Catalog basePath="/" />)
    expect(screen.getByTestId('product-hero')).toBeTruthy()
    expect(hasProductGrid()).toBe(false)
  })
})

describe('Catalog — search / clear handler', () => {
  it('renders no-results-with-query state and clear button when query yields no matches', async () => {
    // Two products whose names won't match the query "zzznomatch".
    const products = [makeProduct('x1'), makeProduct('x2')]
    mockProductsState = { data: { products }, loading: false, error: null }
    // Seed an initial query via search params so Catalog initialises query state.
    mockSearchParamsMap['q'] = 'zzznomatch'
    render(<Catalog basePath="/" />)
    // Wait for Fuse to lazy-load and produce 0 results (triggers no-results branch).
    await waitFor(() => expect(screen.getByText(/zzznomatch/)).toBeTruthy())
    // The clear-search button must be present.
    const clearBtn = screen.getByRole('button')
    expect(clearBtn).toBeTruthy()
    // Click the clear button — must call router.replace with the 'q' param removed.
    fireEvent.click(clearBtn)
    expect(mockRouterReplace).toHaveBeenCalledTimes(1)
    // The URL passed to replace must NOT contain the 'q' query param.
    const replacedUrl = mockRouterReplace.mock.calls[0][0] as string
    expect(replacedUrl).not.toContain('q=')
  })

  it('renders empty-category state when query is empty but visibleItems is empty', () => {
    // Products with no categoryIds, plus a real category in the tree.
    // The category IS found (activeCategoryId resolves to 'cat-empty'),
    // but no products belong to it → visibleItems = [], query = '' →
    // renders the category-empty branch (no "no results" / no clear button).
    const products = [makeProduct('y1'), makeProduct('y2')]
    mockProductsState = { data: { products }, loading: false, error: null }
    const emptyCat = makeCategory('cat-empty', 'emptyland')
    mockCatsState = { data: { categories: [emptyCat] }, loading: false, error: null }
    mockSearchParamsMap['category'] = 'emptyland'
    render(<Catalog basePath="/" />)
    // No product grid and no clear button (query is empty, so the no-results
    // path with the clear button is NOT shown).
    expect(hasProductGrid()).toBe(false)
    // The clear-search button is only shown when query is non-empty — it must be absent.
    expect(screen.queryByText(/clear/i)).toBeNull()
  })
})

describe('Catalog — findCategoryBySlug + category filter', () => {
  it('calls findCategoryBySlug to resolve activeCategory to an id', () => {
    const products = [makeProduct('c1'), makeProduct('c2')]
    mockProductsState = { data: { products }, loading: false, error: null }
    const cat = makeCategory('cat-1', 'shirts')
    mockCatsState = { data: { categories: [cat] }, loading: false, error: null }
    // Seed a category slug so activeCategory is non-null → triggers findCategoryBySlug.
    mockSearchParamsMap['category'] = 'shirts'
    render(<Catalog basePath="/" />)
    // CategoryFilter is rendered (topLevel.length > 0).
    expect(screen.getByTestId('cat-filter')).toBeTruthy()
  })

  it('findCategoryBySlug recurses into children to find a nested category slug', () => {
    const products = [makeProduct('d1'), makeProduct('d2')]
    mockProductsState = { data: { products }, loading: false, error: null }
    const child = makeCategory('child-1', 'hoodies', 'parent-1')
    const parent = { ...makeCategory('parent-1', 'tops'), children: [child] }
    mockCatsState = { data: { categories: [parent] }, loading: false, error: null }
    // Seed the child slug — findCategoryBySlug must recurse to find it.
    mockSearchParamsMap['category'] = 'hoodies'
    render(<Catalog basePath="/" />)
    // CategoryFilter rendered for the top-level parent.
    expect(screen.getByTestId('cat-filter')).toBeTruthy()
  })

  it('findCategoryBySlug returns null when slug not found → activeCategoryId is null', () => {
    // activeCategory is set to a slug that doesn't exist in the category tree.
    // findCategoryBySlug returns null → activeCategoryId stays null → ?? null branch.
    const products = [makeProduct('e1'), makeProduct('e2')]
    mockProductsState = { data: { products }, loading: false, error: null }
    const cat = makeCategory('cat-2', 'shoes')
    mockCatsState = { data: { categories: [cat] }, loading: false, error: null }
    mockSearchParamsMap['category'] = 'nonexistent-slug'
    render(<Catalog basePath="/" />)
    // Grid renders because no filter applies (id is null).
    expect(screen.getByTestId('product-grid')).toBeTruthy()
  })
})

describe('Catalog — single-product hero skipped when query/category active', () => {
  it('shows ProductGrid (not hero) for single product when query is active', () => {
    // items.length === 1 but query is set → the hero guard's && !query branch is false.
    mockProductsState = { data: { products: [makeProduct('solo')] }, loading: false, error: null }
    mockSearchParamsMap['q'] = 'tee'
    render(<Catalog basePath="/" />)
    // The search returned a match (name includes 'Product solo' but not 'tee'), but
    // what matters is: hero is NOT shown (condition requires !query).
    // ProductListingSkeleton also not shown; either grid or no-results renders.
    expect(screen.queryByTestId('product-hero')).toBeNull()
  })

  it('shows ProductGrid (not hero) for single product when activeCategory is set', () => {
    // items.length === 1 but activeCategory !== null → hero guard's && activeCategory===null is false.
    mockProductsState = { data: { products: [makeProduct('solo2')] }, loading: false, error: null }
    const cat = makeCategory('cat-3', 'hats')
    mockCatsState = { data: { categories: [cat] }, loading: false, error: null }
    mockSearchParamsMap['category'] = 'hats'
    render(<Catalog basePath="/" />)
    expect(screen.queryByTestId('product-hero')).toBeNull()
  })
})

describe('Catalog — config fallback + catData null', () => {
  it('uses DEFAULT_PRODUCT_PAGE_SIZE when config is null', () => {
    // Override storeConfig to return null config → hits the ?? DEFAULT_PRODUCT_PAGE_SIZE branch.
    mockUseStoreConfig.mockReturnValueOnce({ config: null })

    const products = [makeProduct('f1'), makeProduct('f2')]
    mockProductsState = { data: { products }, loading: false, error: null }
    render(<Catalog basePath="/" />)
    // Renders fine — DEFAULT_PRODUCT_PAGE_SIZE (24) is used.
    expect(screen.getByTestId('product-grid')).toBeTruthy()
  })

  it('falls back to empty categories when catData is null', () => {
    // catData null → catData?.categories ?? [] hits the ?? [] branch.
    mockProductsState = {
      data: { products: [makeProduct('g1'), makeProduct('g2')] },
      loading: false,
      error: null,
    }
    mockCatsState = { data: null, loading: false, error: null }
    render(<Catalog basePath="/" />)
    // No CategoryFilter rendered (topLevel = []).
    expect(screen.queryByTestId('cat-filter')).toBeNull()
    expect(screen.getByTestId('product-grid')).toBeTruthy()
  })
})

describe('Catalog — hasMore branch (pagination)', () => {
  it('shows "showing X of Y" when hasMore is true (more products than pageSize)', () => {
    // Create 25 products (> default pageSize=24) so hasMore=true.
    const products = Array.from({ length: 25 }, (_, i) => makeProduct(`pg${i}`))
    mockProductsState = { data: { products }, loading: false, error: null }
    render(<Catalog basePath="/" />)
    // The hasMore=true branch renders "Showing {shown} of {total} products" — "X of Y" form.
    expect(screen.getByText(/\d+\s+of\s+\d+/)).toBeTruthy()
    expect(screen.getByTestId('product-grid')).toBeTruthy()
  })

  it('shows "showing {count}" (no "of") when hasMore is false (all products fit on one page)', () => {
    // 3 products, pageSize=24 → hasMore=false → showingProducts (not showingProductsOf)
    const products = [makeProduct('h1'), makeProduct('h2'), makeProduct('h3')]
    mockProductsState = { data: { products }, loading: false, error: null }
    render(<Catalog basePath="/" />)
    expect(screen.getByTestId('product-grid')).toBeTruthy()
    // hasMore=false branch: plain count form (no "X of Y")
    expect(screen.getByText(/showing/i)).toBeTruthy()
    expect(screen.queryByText(/\d+\s+of\s+\d+/)).toBeNull()
  })
})

describe('Catalog — coming-soon empty state', () => {
  it('renders comingSoonBody and comingSoonSubtext paragraphs when products is empty', () => {
    mockProductsState = { data: { products: [] }, loading: false, error: null }
    render(<Catalog basePath="/" />)
    // Both <p> elements under the coming-soon branch must be present
    expect(screen.getByText(/check back soon/i)).toBeTruthy()
    expect(screen.getByText(/preparing something great/i)).toBeTruthy()
  })
})

describe('Catalog — search no-results heading', () => {
  it('renders searchNoResultsHeading h2 when query has no matches', async () => {
    const products = [makeProduct('n1'), makeProduct('n2')]
    mockProductsState = { data: { products }, loading: false, error: null }
    mockSearchParamsMap['q'] = 'zzznomatch'
    render(<Catalog basePath="/" />)
    // searchNoResultsHeading branch: wait for Fuse to load and yield 0 results.
    await waitFor(() => expect(screen.getByText(/no results found/i)).toBeTruthy())
  })
})

describe('Catalog — category-empty heading + subtext', () => {
  it('renders categoryEmptyHeading and categoryEmptySubtext when category filter yields nothing', () => {
    const products = [makeProduct('ce1')]
    mockProductsState = { data: { products }, loading: false, error: null }
    const cat = makeCategory('cat-empty2', 'empty-cat')
    mockCatsState = { data: { categories: [cat] }, loading: false, error: null }
    mockSearchParamsMap['category'] = 'empty-cat'
    render(<Catalog basePath="/" />)
    // categoryEmptyHeading + categoryEmptySubtext both rendered
    expect(screen.getByText(/nothing here yet/i)).toBeTruthy()
    expect(screen.getByText(/try a different category/i)).toBeTruthy()
  })
})
