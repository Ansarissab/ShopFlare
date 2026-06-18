// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ProductGrid } from './ProductGrid'
import type { ProductWithVariants } from '@/lib/types/product'

// Mock ProductCard — assert on the props ProductGrid forwards, not ProductCard internals.
vi.mock('@/components/store/product/ProductCard', async () => {
  const { createElement } = await import('react')
  return {
    ProductCard: (props: {
      product: { id: string; name: string }
      variants: unknown[]
      sizes: unknown[]
      images: unknown[]
      priority?: boolean
    }) =>
      createElement(
        'div',
        {
          'data-testid': 'product-card',
          'data-product-id': props.product.id,
          'data-priority': props.priority ? 'true' : 'false',
        },
        `${props.product.name} | sizes:${props.sizes.length} images:${props.images.length} variants:${props.variants.length}`,
      ),
  }
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function makeProduct(id: string, name: string): ProductWithVariants {
  return {
    product: {
      id,
      name,
      description: '',
      active: true,
      reviewsEnabled: true,
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
        label: 'Red',
        colorHex: '#ff0000',
        sortOrder: 0,
        images: [
          { id: `${id}-img1`, variantId: `${id}-v1`, url: '/a.jpg', r2Key: 'a', sortOrder: 0 },
        ],
        sizes: [
          {
            id: `${id}-s1`,
            variantId: `${id}-v1`,
            size: 'M',
            sku: null,
            priceCents: 1000,
            stock: 3,
            stripePriceId: null,
            active: true,
          },
        ],
      },
      {
        id: `${id}-v2`,
        productId: id,
        label: 'Blue',
        colorHex: '#0000ff',
        sortOrder: 1,
        images: [
          { id: `${id}-img2`, variantId: `${id}-v2`, url: '/b.jpg', r2Key: 'b', sortOrder: 0 },
          { id: `${id}-img3`, variantId: `${id}-v2`, url: '/c.jpg', r2Key: 'c', sortOrder: 1 },
        ],
        sizes: [
          {
            id: `${id}-s2`,
            variantId: `${id}-v2`,
            size: 'L',
            sku: null,
            priceCents: 1200,
            stock: 0,
            stripePriceId: null,
            active: true,
          },
        ],
      },
    ],
    faqItems: [],
  }
}

describe('ProductGrid', () => {
  it('renders one ProductCard per item', () => {
    const items = [makeProduct('p1', 'Hoodie'), makeProduct('p2', 'Tee')]
    render(<ProductGrid items={items} />)
    expect(screen.getAllByTestId('product-card')).toHaveLength(2)
    expect(screen.getByText(/Hoodie/)).toBeTruthy()
    expect(screen.getByText(/Tee/)).toBeTruthy()
  })

  it('flattens sizes and images across all variants', () => {
    render(<ProductGrid items={[makeProduct('p1', 'Hoodie')]} />)
    // 2 sizes (one per variant), 3 images (1 + 2), 2 variants
    expect(screen.getByText('Hoodie | sizes:2 images:3 variants:2')).toBeTruthy()
  })

  it('keys cards by product id', () => {
    render(<ProductGrid items={[makeProduct('px', 'Cap')]} />)
    const card = screen.getByTestId('product-card')
    expect(card.getAttribute('data-product-id')).toBe('px')
  })

  it('renders an empty grid when there are no items', () => {
    const { container } = render(<ProductGrid items={[]} />)
    expect(screen.queryByTestId('product-card')).toBeNull()
    // grid wrapper still present
    expect(container.querySelector('div.grid')).toBeTruthy()
  })

  // LCP regression — only the FIRST card (index 0) is the LCP element on mobile.
  // Emitting fetchpriority=high for multiple images saturates mobile 4G bandwidth
  // and delays the true LCP paint. A single hi-priority preload is the correct fix;
  // every subsequent card must be lazy-loaded (priority=false).
  it('marks only the first card as priority; all others are non-priority', () => {
    const items = Array.from({ length: 6 }, (_, i) => makeProduct(`p${i}`, `Product ${i}`))
    render(<ProductGrid items={items} />)
    const cards = screen.getAllByTestId('product-card')
    expect(cards).toHaveLength(6)
    // Only index 0 → priority (the LCP image)
    expect(cards[0].getAttribute('data-priority')).toBe('true')
    // All remaining → non-priority (lazy)
    for (let i = 1; i < 6; i++) {
      expect(cards[i].getAttribute('data-priority')).toBe('false')
    }
  })

  it('single-item grid: the only card is priority (it is the LCP image)', () => {
    const items = [makeProduct('p0', 'Solo')]
    render(<ProductGrid items={items} />)
    const [card] = screen.getAllByTestId('product-card')
    expect(card.getAttribute('data-priority')).toBe('true')
  })
})
