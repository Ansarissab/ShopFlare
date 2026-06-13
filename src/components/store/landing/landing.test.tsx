// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import React, { Suspense } from 'react'
import { en } from '@/lib/i18n/en'
import type { LandingSection } from '@/lib/types'
import type { ProductWithVariants } from '@/lib/types/product'

// ── Shared mocks ────────────────────────────────────────────────────────────

vi.mock('@/lib/i18n/server', () => ({
  getT: () => Promise.resolve(en),
}))

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
  // Dynamic import to avoid hoisting issues with mocks
  async function renderCTA(props: Partial<LandingSection> = {}) {
    const { CTABand } = await import('./CTABand')
    return render(await CTABand({ section: makeSection({ sectionKey: 'cta', ...props }) }))
  }

  it('renders default heading when section.heading is null', async () => {
    await renderCTA()
    expect(screen.getByText(en.store.ctaDefaultHeading)).toBeTruthy()
  })

  it('renders custom heading', async () => {
    await renderCTA({ heading: 'Join Our Store' })
    expect(screen.getByText('Join Our Store')).toBeTruthy()
  })

  it('renders CTA link with default /shop href', async () => {
    await renderCTA()
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/shop')
    expect(link.textContent).toBe(en.store.ctaDefaultCta)
  })

  it('renders CTA link with custom href', async () => {
    await renderCTA({ ctaHref: '/sale', ctaText: 'Sale Now' })
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/sale')
    expect(link.textContent).toBe('Sale Now')
  })
})

// ── HeroSection ──────────────────────────────────────────────────────────────

describe('HeroSection', () => {
  async function renderHero(
    sectionOverrides: Partial<LandingSection> = {},
    heroStyle = 'image-left',
    imageUrl: string | null = null,
  ) {
    const { HeroSection } = await import('./HeroSection')
    return render(
      await HeroSection({
        section: makeSection(sectionOverrides),
        heroStyle,
        imageUrl,
      }),
    )
  }

  it('renders default heading via en.store.heroDefaultHeading', async () => {
    await renderHero()
    expect(screen.getByText(en.store.heroDefaultHeading)).toBeTruthy()
  })

  it('renders custom heading', async () => {
    await renderHero({ heading: 'Welcome to Our Store' })
    expect(screen.getByText('Welcome to Our Store')).toBeTruthy()
  })

  it('sets data-hero-style attribute on section element', async () => {
    const { container } = await renderHero({}, 'centered')
    const section = container.querySelector('[data-hero-style="centered"]')
    expect(section).toBeTruthy()
  })

  it('renders image when imageUrl provided', async () => {
    const { container } = await renderHero({}, 'image-left', '/cdn/hero.avif')
    expect(container.querySelector('img')).toBeTruthy()
  })

  it('does not render image when imageUrl is null', async () => {
    const { container } = await renderHero({}, 'image-left', null)
    expect(container.querySelector('img')).toBeNull()
  })

  it('renders full-bleed variant (section has min-h class)', async () => {
    const { container } = await renderHero({}, 'full-bleed')
    const section = container.querySelector('[data-hero-style="full-bleed"]')
    expect(section?.className).toContain('min-h')
  })

  it('renders split variant', async () => {
    const { container } = await renderHero({}, 'split')
    expect(container.querySelector('[data-hero-style="split"]')).toBeTruthy()
  })

  it('renders CTA link with default /shop href', async () => {
    await renderHero()
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/shop')
  })

  it('renders CTA link with custom href', async () => {
    await renderHero({ ctaHref: '/products' })
    expect(screen.getByRole('link').getAttribute('href')).toBe('/products')
  })
})

// ── StorySection ─────────────────────────────────────────────────────────────

describe('StorySection', () => {
  async function renderStory(
    sectionOverrides: Partial<LandingSection> = {},
    imageUrl: string | null = null,
  ) {
    const { StorySection } = await import('./StorySection')
    return render(
      await StorySection({
        section: makeSection({ sectionKey: 'story', ...sectionOverrides }),
        imageUrl,
      }),
    )
  }

  it('renders default heading', async () => {
    await renderStory()
    expect(screen.getByText(en.store.storyDefaultHeading)).toBeTruthy()
  })

  it('renders custom heading', async () => {
    await renderStory({ heading: 'Our Journey' })
    expect(screen.getByText('Our Journey')).toBeTruthy()
  })

  it('renders RenderHtml when bodyHtml is provided', async () => {
    await renderStory({ bodyHtml: '<p>Founded in 2020</p>' })
    expect(screen.getByTestId('render-html')).toBeTruthy()
  })

  it('does not render RenderHtml when bodyHtml is null', async () => {
    await renderStory({ bodyHtml: null })
    expect(screen.queryByTestId('render-html')).toBeNull()
  })

  it('renders image when imageUrl is provided', async () => {
    const { container } = await renderStory({}, '/cdn/story.avif')
    expect(container.querySelector('img')).toBeTruthy()
  })

  it('does not render image when imageUrl is null', async () => {
    const { container } = await renderStory({}, null)
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

  async function renderFeatured(
    products: ProductWithVariants[] = [],
    sectionOverrides: Partial<LandingSection> = {},
  ) {
    const { FeaturedProductsStrip } = await import('./FeaturedProductsStrip')
    return render(
      await FeaturedProductsStrip({
        section: makeSection({ sectionKey: 'featured', ...sectionOverrides }),
        products,
      }),
    )
  }

  it('returns null when products array is empty', async () => {
    const { container } = await renderFeatured([])
    expect(container.querySelector('section')).toBeNull()
  })

  it('renders heading and product cards when products provided', async () => {
    await renderFeatured([mockProduct])
    expect(screen.getByTestId('product-card-p1')).toBeTruthy()
  })

  it('renders default heading when section.heading is null', async () => {
    await renderFeatured([mockProduct])
    expect(screen.getByText(en.store.featuredProductsHeading)).toBeTruthy()
  })

  it('renders custom heading', async () => {
    await renderFeatured([mockProduct], { heading: 'Staff Picks' })
    expect(screen.getByText('Staff Picks')).toBeTruthy()
  })
})

// ── ReviewsStrip ─────────────────────────────────────────────────────────────

describe('ReviewsStrip', () => {
  async function renderReviews() {
    const { ReviewsStrip } = await import('./ReviewsStrip')
    return render(<ReviewsStrip section={makeSection({ sectionKey: 'reviews' })} />)
  }

  it('renders null when not loading and no reviews', async () => {
    mockApiData = { reviews: [] }
    mockApiLoading = false
    const { container } = await renderReviews()
    expect(container.querySelector('section')).toBeNull()
  })

  it('renders loading skeletons when loading', async () => {
    mockApiLoading = true
    mockApiData = null
    const { container } = await renderReviews()
    expect(container.querySelector('.animate-pulse')).toBeTruthy()
  })

  it('renders review cards when data arrives', async () => {
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
    await renderReviews()
    expect(screen.getByText('Alice')).toBeTruthy()
    expect(screen.getByText('Great!')).toBeTruthy()
  })

  it('renders default heading', async () => {
    mockApiLoading = true
    await renderReviews()
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

  async function renderLanding(
    sectionOverrides: Partial<Record<string, Partial<LandingSection>>> = {},
    products: ProductWithVariants[] = [],
  ) {
    const { LandingPage } = await import('./LandingPage')
    let result: ReturnType<typeof render> | undefined
    await act(async () => {
      result = render(
        <Suspense fallback={null}>
          <LandingPage
            landing={{
              sections: makeAllSections(sectionOverrides) as never,
              featuredProducts: products,
            }}
            storeConfig={{ storeName: 'TestStore' }}
          />
        </Suspense>,
      )
    })
    return result!
  }

  it('renders enabled sections', async () => {
    const { container } = await renderLanding()
    // All 5 sections enabled by default → at least a <main> with children
    expect(container.querySelector('main')).toBeTruthy()
  })

  it('skips sections where enabled is false', async () => {
    const { container } = await renderLanding({ hero: { enabled: false }, cta: { enabled: false } })
    const sections = container.querySelectorAll('section')
    // featured returns null when no products; reviews returns null when no data
    // story section should still render
    expect(sections.length).toBeGreaterThanOrEqual(0)
    // No hero section (data-hero-style attr is on the hero section element)
    expect(container.querySelector('[data-hero-style]')).toBeNull()
  })

  it('renders LandingPage with all sections disabled → empty main', async () => {
    const { container } = await renderLanding({
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
