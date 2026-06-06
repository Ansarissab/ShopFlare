// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
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
  useCart: () => ({ openCart }),
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

  it('renders the Track Order link', () => {
    render(<StorefrontHeader />)
    const link = screen.getByText(en.store.trackOrder)
    expect(link.getAttribute('href')).toBe('/track')
  })

  it('clicking cart button calls openCart', () => {
    render(<StorefrontHeader />)
    fireEvent.click(screen.getByLabelText('Open cart'))
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

  it('passes zero shipping props to CartSheet when no config', () => {
    render(<StorefrontHeader />)
    expect(cartSheetProps).toHaveBeenCalledWith({ flatRateCents: 0, thresholdCents: 0 })
  })

  it('passes live shipping config to CartSheet', () => {
    mockConfig = { flatShippingRateCents: 500, freeShippingThresholdCents: 10000 }
    render(<StorefrontHeader />)
    expect(cartSheetProps).toHaveBeenCalledWith({ flatRateCents: 500, thresholdCents: 10000 })
  })
})
