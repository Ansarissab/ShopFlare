// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import React from 'react'
import { en } from '@/lib/i18n/en'
import { WiseTemplate } from './WiseTemplate'
import { StripeTemplate } from './StripeTemplate'
import { YcTemplate } from './YcTemplate'
import type { LandingSection, LandingData } from '@/lib/types'
import type { ProductWithVariants } from '@/lib/types/product'

// ── Shared mocks (mirror landing.test.tsx) ───────────────────────────────────

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

const mockProduct2: ProductWithVariants = {
  product: {
    id: 'p2',
    name: 'Summer Hat',
    slug: 'summer-hat',
    price: 1500,
    description: null,
    categoryId: null,
    categorySlug: null,
    displayOrder: 1,
    isHidden: false,
    whatsappEnabled: true,
    reviewsEnabled: true,
    reviewSummary: null,
    updatedAt: '2024-01-01',
  },
  variants: [mockVariant],
} as unknown as ProductWithVariants

function makeAllSections(
  overrides: Partial<Record<string, Partial<LandingSection>>> = {},
): Record<string, LandingSection> {
  const keys = ['hero', 'story', 'featured', 'reviews', 'cta'] as const
  return Object.fromEntries(keys.map((k) => [k, makeSection({ sectionKey: k, ...overrides[k] })]))
}

function makeLanding(
  sectionOverrides: Partial<Record<string, Partial<LandingSection>>> = {},
  products: ProductWithVariants[] = [mockProduct, mockProduct2],
): LandingData {
  return {
    sections: makeAllSections(sectionOverrides) as LandingData['sections'],
    featuredProducts: products,
  }
}

const storeConfig = { storeName: 'TestStore' }

// ── WiseTemplate ─────────────────────────────────────────────────────────────

describe('WiseTemplate', () => {
  it('renders main-content wrapper', () => {
    const { container } = render(
      <WiseTemplate landing={makeLanding()} storeConfig={storeConfig} t={en} />,
    )
    expect(container.querySelector('#main-content')).toBeTruthy()
  })

  it('renders hero heading (default)', () => {
    render(
      <WiseTemplate
        landing={makeLanding({ hero: { heading: null } })}
        storeConfig={storeConfig}
        t={en}
      />,
    )
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy()
  })

  it('renders custom hero heading', () => {
    render(
      <WiseTemplate
        landing={makeLanding({ hero: { heading: 'Welcome to Wise' } })}
        storeConfig={storeConfig}
        t={en}
      />,
    )
    expect(screen.getByText('Welcome to Wise')).toBeTruthy()
  })

  it('renders hero CTA button with default /shop href', () => {
    render(<WiseTemplate landing={makeLanding()} storeConfig={storeConfig} t={en} />)
    const links = screen.getAllByRole('link')
    const heroLink = links.find((l) => l.getAttribute('href') === '/shop')
    expect(heroLink).toBeTruthy()
  })

  it('renders hero CTA with custom href', () => {
    render(
      <WiseTemplate
        landing={makeLanding({ hero: { ctaHref: '/sale', ctaText: 'Shop Sale' } })}
        storeConfig={storeConfig}
        t={en}
      />,
    )
    expect(screen.getByText('Shop Sale').closest('a')?.getAttribute('href')).toBe('/sale')
  })

  it('renders hero image when imageR2Key is set', () => {
    const { container } = render(
      <WiseTemplate
        landing={makeLanding({ hero: { imageR2Key: 'hero.avif' } })}
        storeConfig={storeConfig}
        t={en}
      />,
    )
    expect(container.querySelector('img')).toBeTruthy()
  })

  it('does NOT render hero image when imageR2Key is null', () => {
    const { container } = render(
      <WiseTemplate
        landing={makeLanding({ hero: { imageR2Key: null } })}
        storeConfig={storeConfig}
        t={en}
      />,
    )
    // hero has no image; story has no image either in this fixture
    expect(container.querySelector('img')).toBeNull()
  })

  it('renders hero subtext when provided', () => {
    render(
      <WiseTemplate
        landing={makeLanding({ hero: { subtext: 'Bold & Friendly' } })}
        storeConfig={storeConfig}
        t={en}
      />,
    )
    expect(screen.getByText('Bold & Friendly')).toBeTruthy()
  })

  it('renders story section heading', () => {
    render(<WiseTemplate landing={makeLanding()} storeConfig={storeConfig} t={en} />)
    expect(screen.getByText(en.store.storyDefaultHeading)).toBeTruthy()
  })

  it('renders story custom heading', () => {
    render(
      <WiseTemplate
        landing={makeLanding({ story: { heading: 'Our Wise Story' } })}
        storeConfig={storeConfig}
        t={en}
      />,
    )
    expect(screen.getByText('Our Wise Story')).toBeTruthy()
  })

  it('renders story bodyHtml via RenderHtml', () => {
    render(
      <WiseTemplate
        landing={makeLanding({ story: { bodyHtml: '<p>Founded 2020</p>' } })}
        storeConfig={storeConfig}
        t={en}
      />,
    )
    expect(screen.getByTestId('render-html')).toBeTruthy()
  })

  it('does NOT render RenderHtml when story bodyHtml is null', () => {
    render(
      <WiseTemplate
        landing={makeLanding({ story: { bodyHtml: null } })}
        storeConfig={storeConfig}
        t={en}
      />,
    )
    expect(screen.queryByTestId('render-html')).toBeNull()
  })

  it('renders story image when imageR2Key is set', () => {
    const { container } = render(
      <WiseTemplate
        landing={makeLanding({ story: { imageR2Key: 'story.avif' } })}
        storeConfig={storeConfig}
        t={en}
      />,
    )
    expect(container.querySelector('img')).toBeTruthy()
  })

  it('renders featured products', () => {
    render(<WiseTemplate landing={makeLanding()} storeConfig={storeConfig} t={en} />)
    expect(screen.getByTestId('product-card-p1')).toBeTruthy()
    expect(screen.getByTestId('product-card-p2')).toBeTruthy()
  })

  it('renders featured custom heading', () => {
    render(
      <WiseTemplate
        landing={makeLanding({ featured: { heading: 'Staff Picks' } })}
        storeConfig={storeConfig}
        t={en}
      />,
    )
    expect(screen.getByText('Staff Picks')).toBeTruthy()
  })

  it('skips featured section when no products', () => {
    render(<WiseTemplate landing={makeLanding({}, [])} storeConfig={storeConfig} t={en} />)
    expect(screen.queryByTestId('product-card-p1')).toBeNull()
  })

  it('renders CTA heading', () => {
    render(<WiseTemplate landing={makeLanding()} storeConfig={storeConfig} t={en} />)
    expect(screen.getByText(en.store.ctaDefaultHeading)).toBeTruthy()
  })

  it('renders CTA custom heading + subtext', () => {
    render(
      <WiseTemplate
        landing={makeLanding({ cta: { heading: 'Get Wise', subtext: 'Join thousands' } })}
        storeConfig={storeConfig}
        t={en}
      />,
    )
    expect(screen.getByText('Get Wise')).toBeTruthy()
    expect(screen.getByText('Join thousands')).toBeTruthy()
  })

  it('skips sections where enabled=false', () => {
    const { container } = render(
      <WiseTemplate
        landing={makeLanding({
          hero: { enabled: false },
          story: { enabled: false },
          cta: { enabled: false },
        })}
        storeConfig={storeConfig}
        t={en}
      />,
    )
    // Hero is gone — no h1
    expect(container.querySelector('h1')).toBeNull()
    // Story is gone — no story heading
    expect(screen.queryByText(en.store.storyDefaultHeading)).toBeNull()
    // Featured still renders
    expect(screen.getByTestId('product-card-p1')).toBeTruthy()
  })

  it('renders all sections disabled → empty wrapper', () => {
    const { container } = render(
      <WiseTemplate
        landing={makeLanding({
          hero: { enabled: false },
          story: { enabled: false },
          featured: { enabled: false },
          reviews: { enabled: false },
          cta: { enabled: false },
        })}
        storeConfig={storeConfig}
        t={en}
      />,
    )
    expect(container.querySelector('#main-content')).toBeTruthy()
    expect(container.querySelector('section')).toBeNull()
  })

  it('falls back to storeName for hero heading when section.heading is null', () => {
    render(
      <WiseTemplate
        landing={makeLanding({ hero: { heading: null } })}
        storeConfig={{ storeName: 'MyBrand' }}
        t={en}
      />,
    )
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('MyBrand')
  })

  it('falls back to heroDefaultHeading when section.heading and storeName are both empty', () => {
    render(
      <WiseTemplate
        landing={makeLanding({ hero: { heading: null } })}
        storeConfig={{ storeName: '' }}
        t={en}
      />,
    )
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(en.store.heroDefaultHeading)
  })

  it('renders null for unknown section key (dead-code guard)', () => {
    // Inject an unknown key into sections via cast to exercise the final `return null`
    const landing = makeLanding()
    const landingWithExtra = {
      ...landing,
      sections: {
        ...landing.sections,
        unknown: makeSection({ sectionKey: 'hero', enabled: true }),
      },
    } as unknown as typeof landing
    const { container } = render(
      <WiseTemplate landing={landingWithExtra} storeConfig={storeConfig} t={en} />,
    )
    // Still renders the wrapper; the unknown key returns null without error
    expect(container.querySelector('#main-content')).toBeTruthy()
  })
})

// ── StripeTemplate ────────────────────────────────────────────────────────────

describe('StripeTemplate', () => {
  it('renders main-content wrapper', () => {
    const { container } = render(
      <StripeTemplate landing={makeLanding()} storeConfig={storeConfig} t={en} />,
    )
    expect(container.querySelector('#main-content')).toBeTruthy()
  })

  it('renders hero heading (default)', () => {
    render(
      <StripeTemplate
        landing={makeLanding({ hero: { heading: null } })}
        storeConfig={storeConfig}
        t={en}
      />,
    )
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy()
  })

  it('renders custom hero heading', () => {
    render(
      <StripeTemplate
        landing={makeLanding({ hero: { heading: 'Stripe Style Store' } })}
        storeConfig={storeConfig}
        t={en}
      />,
    )
    expect(screen.getByText('Stripe Style Store')).toBeTruthy()
  })

  it('renders hero subtext when provided', () => {
    render(
      <StripeTemplate
        landing={makeLanding({ hero: { subtext: 'Refined & Precise' } })}
        storeConfig={storeConfig}
        t={en}
      />,
    )
    expect(screen.getByText('Refined & Precise')).toBeTruthy()
  })

  it('renders hero image when imageR2Key is set', () => {
    const { container } = render(
      <StripeTemplate
        landing={makeLanding({ hero: { imageR2Key: 'hero.avif' } })}
        storeConfig={storeConfig}
        t={en}
      />,
    )
    expect(container.querySelector('img')).toBeTruthy()
  })

  it('does NOT render hero image when imageR2Key is null', () => {
    const { container } = render(
      <StripeTemplate
        landing={makeLanding({ hero: { imageR2Key: null } })}
        storeConfig={storeConfig}
        t={en}
      />,
    )
    expect(container.querySelector('img')).toBeNull()
  })

  it('renders hero CTA link with custom href', () => {
    render(
      <StripeTemplate
        landing={makeLanding({ hero: { ctaHref: '/new-arrivals', ctaText: 'New Arrivals' } })}
        storeConfig={storeConfig}
        t={en}
      />,
    )
    expect(screen.getByText('New Arrivals').closest('a')?.getAttribute('href')).toBe(
      '/new-arrivals',
    )
  })

  it('renders story section heading', () => {
    render(<StripeTemplate landing={makeLanding()} storeConfig={storeConfig} t={en} />)
    expect(screen.getByText(en.store.storyDefaultHeading)).toBeTruthy()
  })

  it('renders story custom heading', () => {
    render(
      <StripeTemplate
        landing={makeLanding({ story: { heading: 'Our Stripe Story' } })}
        storeConfig={storeConfig}
        t={en}
      />,
    )
    expect(screen.getByText('Our Stripe Story')).toBeTruthy()
  })

  it('renders story bodyHtml via RenderHtml', () => {
    render(
      <StripeTemplate
        landing={makeLanding({ story: { bodyHtml: '<p>About us</p>' } })}
        storeConfig={storeConfig}
        t={en}
      />,
    )
    expect(screen.getByTestId('render-html')).toBeTruthy()
  })

  it('does NOT render RenderHtml when story bodyHtml is null', () => {
    render(
      <StripeTemplate
        landing={makeLanding({ story: { bodyHtml: null } })}
        storeConfig={storeConfig}
        t={en}
      />,
    )
    expect(screen.queryByTestId('render-html')).toBeNull()
  })

  it('renders story image when imageR2Key is set', () => {
    const { container } = render(
      <StripeTemplate
        landing={makeLanding({ story: { imageR2Key: 'story.avif' } })}
        storeConfig={storeConfig}
        t={en}
      />,
    )
    expect(container.querySelector('img')).toBeTruthy()
  })

  it('renders featured products', () => {
    render(<StripeTemplate landing={makeLanding()} storeConfig={storeConfig} t={en} />)
    expect(screen.getByTestId('product-card-p1')).toBeTruthy()
    expect(screen.getByTestId('product-card-p2')).toBeTruthy()
  })

  it('renders featured custom heading', () => {
    render(
      <StripeTemplate
        landing={makeLanding({ featured: { heading: 'Our Picks' } })}
        storeConfig={storeConfig}
        t={en}
      />,
    )
    expect(screen.getByText('Our Picks')).toBeTruthy()
  })

  it('renders featured subtext when provided', () => {
    render(
      <StripeTemplate
        landing={makeLanding({ featured: { subtext: 'Curated for you' } })}
        storeConfig={storeConfig}
        t={en}
      />,
    )
    expect(screen.getByText('Curated for you')).toBeTruthy()
  })

  it('skips featured section when no products', () => {
    render(<StripeTemplate landing={makeLanding({}, [])} storeConfig={storeConfig} t={en} />)
    expect(screen.queryByTestId('product-card-p1')).toBeNull()
  })

  it('renders CTA heading', () => {
    render(<StripeTemplate landing={makeLanding()} storeConfig={storeConfig} t={en} />)
    expect(screen.getByText(en.store.ctaDefaultHeading)).toBeTruthy()
  })

  it('renders CTA custom heading + subtext', () => {
    render(
      <StripeTemplate
        landing={makeLanding({ cta: { heading: 'Stripe CTA', subtext: 'Act now' } })}
        storeConfig={storeConfig}
        t={en}
      />,
    )
    expect(screen.getByText('Stripe CTA')).toBeTruthy()
    expect(screen.getByText('Act now')).toBeTruthy()
  })

  it('skips sections where enabled=false', () => {
    const { container } = render(
      <StripeTemplate
        landing={makeLanding({
          hero: { enabled: false },
          story: { enabled: false },
          cta: { enabled: false },
        })}
        storeConfig={storeConfig}
        t={en}
      />,
    )
    expect(container.querySelector('h1')).toBeNull()
    expect(screen.queryByText(en.store.storyDefaultHeading)).toBeNull()
    expect(screen.getByTestId('product-card-p1')).toBeTruthy()
  })

  it('renders all sections disabled → empty wrapper', () => {
    const { container } = render(
      <StripeTemplate
        landing={makeLanding({
          hero: { enabled: false },
          story: { enabled: false },
          featured: { enabled: false },
          reviews: { enabled: false },
          cta: { enabled: false },
        })}
        storeConfig={storeConfig}
        t={en}
      />,
    )
    expect(container.querySelector('#main-content')).toBeTruthy()
    expect(container.querySelector('section')).toBeNull()
  })

  it('falls back to storeName for hero heading', () => {
    render(
      <StripeTemplate
        landing={makeLanding({ hero: { heading: null } })}
        storeConfig={{ storeName: 'StripeStore' }}
        t={en}
      />,
    )
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('StripeStore')
  })

  it('falls back to heroDefaultHeading when section.heading and storeName are both empty', () => {
    render(
      <StripeTemplate
        landing={makeLanding({ hero: { heading: null } })}
        storeConfig={{ storeName: '' }}
        t={en}
      />,
    )
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(en.store.heroDefaultHeading)
  })

  it('renders null for unknown section key (dead-code guard)', () => {
    const landing = makeLanding()
    const landingWithExtra = {
      ...landing,
      sections: {
        ...landing.sections,
        unknown: makeSection({ sectionKey: 'hero', enabled: true }),
      },
    } as unknown as typeof landing
    const { container } = render(
      <StripeTemplate landing={landingWithExtra} storeConfig={storeConfig} t={en} />,
    )
    expect(container.querySelector('#main-content')).toBeTruthy()
  })
})

// ── YcTemplate ────────────────────────────────────────────────────────────────

describe('YcTemplate', () => {
  it('renders main-content wrapper', () => {
    const { container } = render(
      <YcTemplate landing={makeLanding()} storeConfig={storeConfig} t={en} />,
    )
    expect(container.querySelector('#main-content')).toBeTruthy()
  })

  it('renders hero heading (default)', () => {
    render(
      <YcTemplate
        landing={makeLanding({ hero: { heading: null } })}
        storeConfig={storeConfig}
        t={en}
      />,
    )
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy()
  })

  it('renders custom hero heading', () => {
    render(
      <YcTemplate
        landing={makeLanding({ hero: { heading: 'Minimal YC Store' } })}
        storeConfig={storeConfig}
        t={en}
      />,
    )
    expect(screen.getByText('Minimal YC Store')).toBeTruthy()
  })

  it('renders hero subtext when provided', () => {
    render(
      <YcTemplate
        landing={makeLanding({ hero: { subtext: 'Editorial & Minimal' } })}
        storeConfig={storeConfig}
        t={en}
      />,
    )
    expect(screen.getByText('Editorial & Minimal')).toBeTruthy()
  })

  it('renders hero image when imageR2Key is set', () => {
    const { container } = render(
      <YcTemplate
        landing={makeLanding({ hero: { imageR2Key: 'hero.avif' } })}
        storeConfig={storeConfig}
        t={en}
      />,
    )
    expect(container.querySelector('img')).toBeTruthy()
  })

  it('does NOT render hero image when imageR2Key is null', () => {
    const { container } = render(
      <YcTemplate
        landing={makeLanding({ hero: { imageR2Key: null } })}
        storeConfig={storeConfig}
        t={en}
      />,
    )
    expect(container.querySelector('img')).toBeNull()
  })

  it('renders hero CTA link with custom href', () => {
    render(
      <YcTemplate
        landing={makeLanding({ hero: { ctaHref: '/collections', ctaText: 'Browse All' } })}
        storeConfig={storeConfig}
        t={en}
      />,
    )
    expect(screen.getByText('Browse All').closest('a')?.getAttribute('href')).toBe('/collections')
  })

  it('renders story section heading', () => {
    render(<YcTemplate landing={makeLanding()} storeConfig={storeConfig} t={en} />)
    expect(screen.getByText(en.store.storyDefaultHeading)).toBeTruthy()
  })

  it('renders story custom heading', () => {
    render(
      <YcTemplate
        landing={makeLanding({ story: { heading: 'Our YC Story' } })}
        storeConfig={storeConfig}
        t={en}
      />,
    )
    expect(screen.getByText('Our YC Story')).toBeTruthy()
  })

  it('renders story bodyHtml via RenderHtml', () => {
    render(
      <YcTemplate
        landing={makeLanding({ story: { bodyHtml: '<p>Founded by builders</p>' } })}
        storeConfig={storeConfig}
        t={en}
      />,
    )
    expect(screen.getByTestId('render-html')).toBeTruthy()
  })

  it('does NOT render RenderHtml when story bodyHtml is null', () => {
    render(
      <YcTemplate
        landing={makeLanding({ story: { bodyHtml: null } })}
        storeConfig={storeConfig}
        t={en}
      />,
    )
    expect(screen.queryByTestId('render-html')).toBeNull()
  })

  it('renders story image when imageR2Key is set', () => {
    const { container } = render(
      <YcTemplate
        landing={makeLanding({ story: { imageR2Key: 'story.avif' } })}
        storeConfig={storeConfig}
        t={en}
      />,
    )
    expect(container.querySelector('img')).toBeTruthy()
  })

  it('renders featured products', () => {
    render(<YcTemplate landing={makeLanding()} storeConfig={storeConfig} t={en} />)
    expect(screen.getByTestId('product-card-p1')).toBeTruthy()
    expect(screen.getByTestId('product-card-p2')).toBeTruthy()
  })

  it('renders featured custom heading', () => {
    render(
      <YcTemplate
        landing={makeLanding({ featured: { heading: 'Top Picks' } })}
        storeConfig={storeConfig}
        t={en}
      />,
    )
    expect(screen.getByText('Top Picks')).toBeTruthy()
  })

  it('skips featured section when no products', () => {
    render(<YcTemplate landing={makeLanding({}, [])} storeConfig={storeConfig} t={en} />)
    expect(screen.queryByTestId('product-card-p1')).toBeNull()
  })

  it('renders CTA heading', () => {
    render(<YcTemplate landing={makeLanding()} storeConfig={storeConfig} t={en} />)
    expect(screen.getByText(en.store.ctaDefaultHeading)).toBeTruthy()
  })

  it('renders CTA custom heading + subtext', () => {
    render(
      <YcTemplate
        landing={makeLanding({ cta: { heading: 'YC CTA Heading', subtext: 'Simple & clear' } })}
        storeConfig={storeConfig}
        t={en}
      />,
    )
    expect(screen.getByText('YC CTA Heading')).toBeTruthy()
    expect(screen.getByText('Simple & clear')).toBeTruthy()
  })

  it('skips sections where enabled=false', () => {
    const { container } = render(
      <YcTemplate
        landing={makeLanding({
          hero: { enabled: false },
          story: { enabled: false },
          cta: { enabled: false },
        })}
        storeConfig={storeConfig}
        t={en}
      />,
    )
    expect(container.querySelector('h1')).toBeNull()
    expect(screen.queryByText(en.store.storyDefaultHeading)).toBeNull()
    expect(screen.getByTestId('product-card-p1')).toBeTruthy()
  })

  it('renders all sections disabled → empty wrapper', () => {
    const { container } = render(
      <YcTemplate
        landing={makeLanding({
          hero: { enabled: false },
          story: { enabled: false },
          featured: { enabled: false },
          reviews: { enabled: false },
          cta: { enabled: false },
        })}
        storeConfig={storeConfig}
        t={en}
      />,
    )
    expect(container.querySelector('#main-content')).toBeTruthy()
    expect(container.querySelector('section')).toBeNull()
  })

  it('falls back to storeName for hero heading', () => {
    render(
      <YcTemplate
        landing={makeLanding({ hero: { heading: null } })}
        storeConfig={{ storeName: 'YcStore' }}
        t={en}
      />,
    )
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('YcStore')
  })

  it('falls back to heroDefaultHeading when section.heading and storeName are both empty', () => {
    render(
      <YcTemplate
        landing={makeLanding({ hero: { heading: null } })}
        storeConfig={{ storeName: '' }}
        t={en}
      />,
    )
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(en.store.heroDefaultHeading)
  })

  it('renders null for unknown section key (dead-code guard)', () => {
    const landing = makeLanding()
    const landingWithExtra = {
      ...landing,
      sections: {
        ...landing.sections,
        unknown: makeSection({ sectionKey: 'hero', enabled: true }),
      },
    } as unknown as typeof landing
    const { container } = render(
      <YcTemplate landing={landingWithExtra} storeConfig={storeConfig} t={en} />,
    )
    expect(container.querySelector('#main-content')).toBeTruthy()
  })
})
