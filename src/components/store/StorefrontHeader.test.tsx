// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { StorefrontHeader } from './StorefrontHeader'
import { en } from '@/lib/i18n/en'

vi.mock('next/link', async () => {
  const { createElement } = await import('react')
  return {
    default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
      createElement('a', { href, ...rest }, children),
  }
})

vi.mock('next/image', async () => {
  const { createElement } = await import('react')
  return {
    default: (props: Record<string, unknown>) => {
      const { fill, priority, unoptimized, sizes, ...rest } = props
      return createElement('img', rest)
    },
  }
})

const openCart = vi.fn()
let mockItemCount = 0
vi.mock('@/hooks/useCart', () => ({
  useCart: (selector?: (s: { openCart: () => void; lastAddedAt: number }) => unknown) => {
    const state = { openCart, lastAddedAt: 0 }
    return selector ? selector(state) : state
  },
  useCartItemCount: () => mockItemCount,
}))

let mockConfig: Record<string, unknown> | null = null
vi.mock('@/hooks/useStoreConfig', () => ({
  useStoreConfig: () => ({ config: mockConfig }),
}))

let mockCatData: { categories: unknown[] } | undefined
vi.mock('@/hooks/useApiResource', () => ({
  useApiResource: () => ({ data: mockCatData }),
}))

const cartSheetProps = vi.fn()
vi.mock('@/components/store/cart/CartSheet', async () => {
  const { createElement } = await import('react')
  return {
    CartSheet: (props: Record<string, unknown>) => {
      cartSheetProps(props)
      return createElement('div', { 'data-testid': 'cart-sheet' })
    },
  }
})

const categoryNavProps = vi.fn()
vi.mock('@/components/store/categories/CategoryNav', async () => {
  const { createElement } = await import('react')
  return {
    CategoryNav: (props: Record<string, unknown>) => {
      categoryNavProps(props)
      return createElement('div', { 'data-testid': 'category-nav' })
    },
  }
})

const primaryNavProps = vi.fn()
vi.mock('@/components/store/nav/PrimaryNav', async () => {
  const { createElement } = await import('react')
  return {
    PrimaryNav: (props: Record<string, unknown>) => {
      primaryNavProps(props)
      return createElement('div', { 'data-testid': 'primary-nav' })
    },
  }
})

const mobileNavDrawerProps = vi.fn()
vi.mock('@/components/store/nav/MobileNavDrawer', async () => {
  const { createElement } = await import('react')
  return {
    MobileNavDrawer: (props: Record<string, unknown>) => {
      mobileNavDrawerProps(props)
      return createElement('div', { 'data-testid': 'mobile-nav-drawer' })
    },
  }
})

// Mock useSearchOverlay — StorefrontHeader must render inside <SearchProvider>
// but we mock the hook directly so no provider wrapper is needed in tests.
const openSearch = vi.fn()
vi.mock('@/components/store/search/SearchProvider', () => ({
  useSearchOverlay: () => ({ open: false, openSearch, closeSearch: vi.fn() }),
}))

beforeEach(() => {
  mockItemCount = 0
  mockConfig = null
  mockCatData = undefined
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('StorefrontHeader', () => {
  it('renders ShopFlare fallback store name when no config', () => {
    render(<StorefrontHeader />)
    expect(screen.getByText('ShopFlare')).toBeTruthy()
  })

  it('renders store name text when config has storeName but no logo', () => {
    mockConfig = { storeName: 'Acme' }
    render(<StorefrontHeader />)
    expect(screen.getByText('Acme')).toBeTruthy()
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('renders logo image when logoUrl present', () => {
    mockConfig = { storeName: 'Acme', logoUrl: '/logo.png' }
    render(<StorefrontHeader />)
    const img = screen.getByRole('img')
    expect(img.getAttribute('src')).toBe('/logo.png')
    expect(img.getAttribute('alt')).toBe('Acme')
  })

  it('uses default logo alt when storeName missing', () => {
    mockConfig = { logoUrl: '/logo.png' }
    render(<StorefrontHeader />)
    expect(screen.getByRole('img').getAttribute('alt')).toBe('Store logo')
  })

  it('renders search button with correct aria-label', () => {
    render(<StorefrontHeader />)
    expect(screen.getByLabelText(en.store.searchLabel)).toBeTruthy()
  })

  it('clicking search button calls openSearch', () => {
    render(<StorefrontHeader />)
    fireEvent.click(screen.getByLabelText(en.store.searchLabel))
    expect(openSearch).toHaveBeenCalledTimes(1)
  })

  it('clicking cart button calls openCart', () => {
    render(<StorefrontHeader />)
    fireEvent.click(screen.getByLabelText(en.store.openCart))
    expect(openCart).toHaveBeenCalledTimes(1)
  })

  it('hides badge when itemCount is 0', () => {
    mockItemCount = 0
    render(<StorefrontHeader />)
    expect(screen.queryByText('0')).toBeNull()
  })

  it('shows numeric badge when itemCount between 1 and 99', () => {
    mockItemCount = 5
    render(<StorefrontHeader />)
    expect(screen.getByText('5')).toBeTruthy()
  })

  it('shows 99+ badge when itemCount over 99', () => {
    mockItemCount = 150
    render(<StorefrontHeader />)
    expect(screen.getByText('99+')).toBeTruthy()
  })

  it('passes categories from api data to CategoryNav', () => {
    mockCatData = { categories: [{ id: 'c1' }] }
    render(<StorefrontHeader />)
    expect(categoryNavProps).toHaveBeenCalledWith({ categories: [{ id: 'c1' }] })
  })

  it('passes empty categories array when api data missing', () => {
    render(<StorefrontHeader />)
    expect(categoryNavProps).toHaveBeenCalledWith({ categories: [] })
  })

  it('passes categories to MobileNavDrawer', () => {
    mockCatData = { categories: [{ id: 'c2' }] }
    render(<StorefrontHeader />)
    const call = mobileNavDrawerProps.mock.calls[0][0] as Record<string, unknown>
    expect(call.categories).toEqual([{ id: 'c2' }])
  })

  it('passes empty categories to MobileNavDrawer when api data missing', () => {
    render(<StorefrontHeader />)
    const call = mobileNavDrawerProps.mock.calls[0][0] as Record<string, unknown>
    expect(call.categories).toEqual([])
  })

  it('passes same links object to both PrimaryNav and MobileNavDrawer', () => {
    mockConfig = { landingEnabled: true }
    render(<StorefrontHeader />)
    const primaryCall = primaryNavProps.mock.calls[0][0] as { links: unknown }
    const mobileCall = mobileNavDrawerProps.mock.calls[0][0] as { links: unknown }
    // Both receive the identical links array (computed once)
    expect(mobileCall.links).toEqual(primaryCall.links)
  })

  it('renders PrimaryNav', () => {
    render(<StorefrontHeader />)
    expect(screen.getByTestId('primary-nav')).toBeTruthy()
  })

  it('passes PrimaryNav links derived from config', () => {
    mockConfig = { landingEnabled: true }
    render(<StorefrontHeader />)
    // buildPrimaryNavLinks with landingEnabled=true returns shopNav + trackOrder links
    const call = primaryNavProps.mock.calls[0][0] as {
      links: Array<{ href: string; labelKey: string }>
    }
    expect(call.links.some((l) => l.labelKey === 'shopNav')).toBe(true)
    expect(call.links.some((l) => l.labelKey === 'trackOrder')).toBe(true)
  })

  it('passes zero shipping props to CartSheet when no config', async () => {
    render(<StorefrontHeader />)
    // CartSheet is lazy — click cart button to trigger mount, then flush async.
    await act(async () => {
      fireEvent.click(screen.getByLabelText(en.store.openCart))
    })
    expect(cartSheetProps).toHaveBeenCalledWith({ flatRateCents: 0, thresholdCents: 0 })
  })

  it('passes live shipping config to CartSheet', async () => {
    mockConfig = { flatShippingRateCents: 500, freeShippingThresholdCents: 10000 }
    render(<StorefrontHeader />)
    // CartSheet is lazy — click cart button to trigger mount, then flush async.
    await act(async () => {
      fireEvent.click(screen.getByLabelText(en.store.openCart))
    })
    expect(cartSheetProps).toHaveBeenCalledWith({ flatRateCents: 500, thresholdCents: 10000 })
  })
})
