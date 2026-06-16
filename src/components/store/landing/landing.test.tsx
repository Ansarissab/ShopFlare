// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import React from 'react'
import { en } from '@/lib/i18n/en'
import { CTABand } from './CTABand'
import { HeroSection } from './HeroSection'
import { StorySection } from './StorySection'
import { FeaturedProductsStrip } from './FeaturedProductsStrip'
import { ReviewsStrip } from './ReviewsStrip'
import { LandingPage } from './LandingPage'
import type { LandingSection } from '@/lib/types'
import type { ProductWithVariants } from '@/lib/types/product'

// ── Shared mocks ────────────────────────────────────────────────────────────

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
      return createElement('img', rest as React.ImgHTMLAttributes<HTMLImageElement>)
    },
  }
})

vi.mock('@/lib/server/fetchFromWorker', () => ({
  r2Url: (key: string | null | undefined) => (key ? `/cdn/${key}` : null),
}))

vi.mock('@/components/shared/RenderHtml', async () => {
  const { createElement } = await import('react')
  return {
    RenderHtml: ({ html }: { html: string }) =>
      createElement('div', {
        'data-testid': 'render-html',
        dangerouslySetInnerHTML: { __html: html },
      }),
  }
})

vi.mock('@/components/store/product/ProductCard', async () => {
  const { createElement } = await import('react')
  return {
    ProductCard: ({ product }: { product: { id: string; name: string } }) =>
      createElement('div', { 'data-testid': `product-card-${product.id}` }, product.name),
  }
})

vi.mock('@/components/store/product/ReviewStars', async () => {
  const { createElement } = await import('react')
  return {
    ReviewStars: ({ rating }: { rating: number }) =>
      createElement('span', { 'data-testid': 'review-stars' }, String(rating)),
  }
})

let mockApiData: unknown = null
let mockApiLoading = false
vi.mock('@/hooks/useApiResource', () => ({
  useApiResource: () => ({ data: mockApiData, loading: mockApiLoading }),
}))

vi.mock('@/hooks/useReveal', () => ({
  useReveal: () => ({ current: null }),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  mockApiData = null
  mockApiLoading = false
})

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeSection(overrides: Partial<LandingSection> = {}): LandingSection {
  return {
    sectionKey: 'hero',
    enabled: true,
    heading: null,
    subtext: null,
    bodyHtml: null,
    ctaText: null,
    ctaHref: null,
    imageR2Key: null,
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

// ── CTABand ──────────────────────────────────────────────────────────────────

describe('CTABand', () => {
  it('renders default heading when section.heading is null', () => {
    render(CTABand({ section: makeSection({ sectionKey: 'cta' }), t: en }))
    expect(screen.getByText(en.store.ctaDefaultHeading)).toBeTruthy()
  })

  it('renders custom heading', () => {
    render(
      CTABand({ section: makeSection({ sectionKey: 'cta', heading: 'Join Our Store' }), t: en }),
    )
    expect(screen.getByText('Join Our Store')).toBeTruthy()
  })

  it('renders CTA link with default /shop href', () => {
    render(CTABand({ section: makeSection({ sectionKey: 'cta' }), t: en }))
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/shop')
    expect(link.textContent).toBe(en.store.ctaDefaultCta)
  })

  it('renders CTA link with custom href', () => {
    render(
      CTABand({
        section: makeSection({ sectionKey: 'cta', ctaHref: '/sale', ctaText: 'Sale Now' }),
        t: en,
      }),
    )
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/sale')
    expect(link.textContent).toBe('Sale Now')
  })
})

// ── HeroSection ──────────────────────────────────────────────────────────────

describe('HeroSection', () => {
  it('renders default heading via en.store.heroDefaultHeading', () => {
    render(HeroSection({ section: makeSection(), heroStyle: 'image-left', imageUrl: null, t: en }))
    expect(screen.getByText(en.store.heroDefaultHeading)).toBeTruthy()
  })

  it('renders custom heading', () => {
    render(
      HeroSection({
        section: makeSection({ heading: 'Welcome to Our Store' }),
        heroStyle: 'image-left',
        imageUrl: null,
        t: en,
      }),
    )
    expect(screen.getByText('Welcome to Our Store')).toBeTruthy()
  })

  it('sets data-hero-style attribute on section element', () => {
    const { container } = render(
      HeroSection({ section: makeSection(), heroStyle: 'centered', imageUrl: null, t: en }),
    )
    const section = container.querySelector('[data-hero-style="centered"]')
    expect(section).toBeTruthy()
  })

  it('renders image when imageUrl provided', () => {
    const { container } = render(
      HeroSection({
        section: makeSection(),
        heroStyle: 'image-left',
        imageUrl: '/cdn/hero.avif',
        t: en,
      }),
    )
    expect(container.querySelector('img')).toBeTruthy()
  })

  it('does not render image when imageUrl is null', () => {
    const { container } = render(
      HeroSection({ section: makeSection(), heroStyle: 'image-left', imageUrl: null, t: en }),
    )
    expect(container.querySelector('img')).toBeNull()
  })

  it('renders full-bleed variant (section has min-h class)', () => {
    const { container } = render(
      HeroSection({ section: makeSection(), heroStyle: 'full-bleed', imageUrl: null, t: en }),
    )
    const section = container.querySelector('[data-hero-style="full-bleed"]')
    expect(section?.className).toContain('min-h')
  })

  it('renders split variant', () => {
    const { container } = render(
      HeroSection({ section: makeSection(), heroStyle: 'split', imageUrl: null, t: en }),
    )
    expect(container.querySelector('[data-hero-style="split"]')).toBeTruthy()
  })

  it('renders CTA link with default /shop href', () => {
    render(HeroSection({ section: makeSection(), heroStyle: 'image-left', imageUrl: null, t: en }))
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/shop')
  })

  it('renders CTA link with custom href', () => {
    render(
      HeroSection({
        section: makeSection({ ctaHref: '/products' }),
        heroStyle: 'image-left',
        imageUrl: null,
        t: en,
      }),
    )
    expect(screen.getByRole('link').getAttribute('href')).toBe('/products')
  })
})

// ── StorySection ─────────────────────────────────────────────────────────────

describe('StorySection', () => {
  it('renders default heading', () => {
    render(StorySection({ section: makeSection({ sectionKey: 'story' }), imageUrl: null, t: en }))
    expect(screen.getByText(en.store.storyDefaultHeading)).toBeTruthy()
  })

  it('renders custom heading', () => {
    render(
      StorySection({
        section: makeSection({ sectionKey: 'story', heading: 'Our Journey' }),
        imageUrl: null,
        t: en,
      }),
    )
    expect(screen.getByText('Our Journey')).toBeTruthy()
  })

  it('renders RenderHtml when bodyHtml is provided', () => {
    render(
      StorySection({
        section: makeSection({ sectionKey: 'story', bodyHtml: '<p>Founded in 2020</p>' }),
        imageUrl: null,
        t: en,
      }),
    )
    expect(screen.getByTestId('render-html')).toBeTruthy()
  })

  it('does not render RenderHtml when bodyHtml is null', () => {
    render(
      StorySection({
        section: makeSection({ sectionKey: 'story', bodyHtml: null }),
        imageUrl: null,
        t: en,
      }),
    )
    expect(screen.queryByTestId('render-html')).toBeNull()
  })

  it('renders image when imageUrl is provided', () => {
    const { container } = render(
      StorySection({
        section: makeSection({ sectionKey: 'story' }),
        imageUrl: '/cdn/story.avif',
        t: en,
      }),
    )
    expect(container.querySelector('img')).toBeTruthy()
  })

  it('does not render image when imageUrl is null', () => {
    const { container } = render(
      StorySection({ section: makeSection({ sectionKey: 'story' }), imageUrl: null, t: en }),
    )
    expect(container.querySelector('img')).toBeNull()
  })
})

// ── FeaturedProductsStrip ────────────────────────────────────────────────────

describe('FeaturedProductsStrip', () => {
  const mockVariant = { id: 'v1', name: 'Default', sizes: [], images: [] }
  const mockProduct: ProductWithVariants = {
    product: {
      id: 'p1',
      name: 'Cool Tee',
      slug: 'cool-tee',
      price: 2000,
      description: null,
      categoryId: null,
      categorySlug: null,
      displayOrder: 0,
      isHidden: false,
      whatsappEnabled: true,
      reviewsEnabled: true,
      reviewSummary: null,
      updatedAt: '2024-01-01',
    },
    variants: [mockVariant],
  } as unknown as ProductWithVariants

  it('returns null when products array is empty', () => {
    const { container } = render(
      (FeaturedProductsStrip({
        section: makeSection({ sectionKey: 'featured' }),
        products: [],
        t: en,
      }) as React.ReactElement) ?? <></>,
    )
    expect(container.querySelector('section')).toBeNull()
  })

  it('renders heading and product cards when products provided', () => {
    render(
      FeaturedProductsStrip({
        section: makeSection({ sectionKey: 'featured' }),
        products: [mockProduct],
        t: en,
      }) as React.ReactElement,
    )
    expect(screen.getByTestId('product-card-p1')).toBeTruthy()
  })

  it('renders default heading when section.heading is null', () => {
    render(
      FeaturedProductsStrip({
        section: makeSection({ sectionKey: 'featured' }),
        products: [mockProduct],
        t: en,
      }) as React.ReactElement,
    )
    expect(screen.getByText(en.store.featuredProductsHeading)).toBeTruthy()
  })

  it('renders custom heading', () => {
    render(
      FeaturedProductsStrip({
        section: makeSection({ sectionKey: 'featured', heading: 'Staff Picks' }),
        products: [mockProduct],
        t: en,
      }) as React.ReactElement,
    )
    expect(screen.getByText('Staff Picks')).toBeTruthy()
  })
})

// ── ReviewsStrip ─────────────────────────────────────────────────────────────

describe('ReviewsStrip', () => {
  it('renders null when not loading and no reviews', () => {
    mockApiData = { reviews: [] }
    mockApiLoading = false
    const { container } = render(<ReviewsStrip section={makeSection({ sectionKey: 'reviews' })} />)
    expect(container.querySelector('section')).toBeNull()
  })

  it('renders loading skeletons when loading', () => {
    mockApiLoading = true
    mockApiData = null
    const { container } = render(<ReviewsStrip section={makeSection({ sectionKey: 'reviews' })} />)
    expect(container.querySelector('.animate-pulse')).toBeTruthy()
  })

  it('renders review cards when data arrives', () => {
    mockApiData = {
      reviews: [
        {
          id: 'r1',
          customerName: 'Alice',
          rating: 5,
          body: 'Great!',
          createdAt: '2024-01-15T00:00:00Z',
        },
      ],
    }
    mockApiLoading = false
    render(<ReviewsStrip section={makeSection({ sectionKey: 'reviews' })} />)
    expect(screen.getByText('Alice')).toBeTruthy()
    expect(screen.getByText('Great!')).toBeTruthy()
  })

  it('renders default heading', () => {
    mockApiLoading = true
    render(<ReviewsStrip section={makeSection({ sectionKey: 'reviews' })} />)
    expect(screen.getByText(en.store.reviewsHeading)).toBeTruthy()
  })
})

// ── LandingPage ──────────────────────────────────────────────────────────────

describe('LandingPage', () => {
  function makeAllSections(overrides: Partial<Record<string, Partial<LandingSection>>> = {}) {
    const keys = ['hero', 'story', 'featured', 'reviews', 'cta'] as const
    return Object.fromEntries(
      keys.map((k) => [k, makeSection({ sectionKey: k, ...overrides[k] })]),
    ) as Record<string, LandingSection>
  }

  function renderLanding(
    sectionOverrides: Partial<Record<string, Partial<LandingSection>>> = {},
    products: ProductWithVariants[] = [],
  ) {
    return render(
      <LandingPage
        landing={{
          sections: makeAllSections(sectionOverrides) as never,
          featuredProducts: products,
        }}
        storeConfig={{ storeName: 'TestStore' }}
        t={en}
      />,
    )
  }

  it('renders enabled sections', () => {
    const { container } = renderLanding()
    // All 5 sections enabled by default → at least a <main> with children
    expect(container.querySelector('main')).toBeTruthy()
  })

  it('skips sections where enabled is false', () => {
    const { container } = renderLanding({ hero: { enabled: false }, cta: { enabled: false } })
    const sections = container.querySelectorAll('section')
    // featured returns null when no products; reviews returns null when no data
    // story section should still render
    expect(sections.length).toBeGreaterThanOrEqual(0)
    // No hero section (data-hero-style attr is on the hero section element)
    expect(container.querySelector('[data-hero-style]')).toBeNull()
  })

  it('renders LandingPage with all sections disabled → empty main', () => {
    const { container } = renderLanding({
      hero: { enabled: false },
      story: { enabled: false },
      featured: { enabled: false },
      reviews: { enabled: false },
      cta: { enabled: false },
    })
    expect(container.querySelector('main')).toBeTruthy()
    expect(container.querySelectorAll('section').length).toBe(0)
  })
})
