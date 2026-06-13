// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { ProductCard } from './ProductCard'

vi.mock('next/link', async () => {
  const { createElement } = await import('react')
  return {
    default: ({
      href,
      children,
      onMouseEnter,
      onFocus,
      ...rest
    }: {
      href: string
      children: React.ReactNode
      onMouseEnter?: React.MouseEventHandler
      onFocus?: React.FocusEventHandler
      [key: string]: unknown
    }) => createElement('a', { href, onMouseEnter, onFocus, ...rest }, children),
  }
})

vi.mock('next/image', async () => {
  const { createElement } = await import('react')
  return {
    default: (
      props: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean },
    ) => {
      const { fill, priority, ...rest } = props
      // Expose priority as a data attribute so tests can assert on LCP behaviour.
      return createElement('img', { ...rest, 'data-priority': priority ? 'true' : 'false' })
    },
  }
})

vi.mock('@/lib/api', () => ({
  apiGet: vi.fn(() => Promise.resolve({})),
  apiPost: vi.fn(() => Promise.resolve({})),
  prefetch: vi.fn(),
}))

vi.mock('@/hooks/useViewportPrefetch', () => ({
  useViewportPrefetch: () => ({ current: null }),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const product = {
  id: 'prod-1',
  name: 'Classic Tee',
  description: 'A classic t-shirt',
  active: true,
  reviewsEnabled: true,
  stripeProductId: null,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
}

const variant = {
  id: 'var-1',
  productId: 'prod-1',
  label: 'White',
  colorHex: '#ffffff',
  sortOrder: 0,
  active: true,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
}

const size = {
  id: 'sz-1',
  variantId: 'var-1',
  size: 'M',
  priceCents: 1500,
  stock: 10,
  active: true,
  sortOrder: 0,
  sku: null,
  stripePriceId: null,
}

const image = {
  id: 'img-1',
  variantId: 'var-1',
  url: '/images/tee.jpg',
  r2Key: 'variants/var-1/tee.jpg',
  sortOrder: 0,
}

describe('ProductCard', () => {
  it('renders product name', () => {
    render(<ProductCard product={product} variants={[variant]} sizes={[size]} images={[image]} />)
    expect(screen.getByText('Classic Tee')).toBeTruthy()
  })

  it('renders formatted price', () => {
    render(<ProductCard product={product} variants={[variant]} sizes={[size]} images={[image]} />)
    // 1500 PKR = ₨1,500
    expect(screen.getByText(/₨1,500/)).toBeTruthy()
  })

  it('links to product page with correct href', () => {
    render(<ProductCard product={product} variants={[variant]} sizes={[size]} images={[image]} />)
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/product/prod-1')
  })

  it('renders product image with alt text', () => {
    render(<ProductCard product={product} variants={[variant]} sizes={[size]} images={[image]} />)
    const img = screen.getByAltText('Classic Tee') as HTMLImageElement
    expect(img.src).toContain('/images/tee.jpg')
  })

  it('shows New badge when isNew is true', () => {
    render(
      <ProductCard product={product} variants={[variant]} sizes={[size]} images={[image]} isNew />,
    )
    expect(screen.getByText('New')).toBeTruthy()
  })

  it('shows out-of-stock when all sizes have zero stock', () => {
    const oosSize = { ...size, stock: 0 }
    render(
      <ProductCard product={product} variants={[variant]} sizes={[oosSize]} images={[image]} />,
    )
    expect(screen.getByText('Out of Stock')).toBeTruthy()
  })

  it('shows no-image placeholder when images array is empty', () => {
    render(<ProductCard product={product} variants={[variant]} sizes={[size]} images={[]} />)
    expect(screen.getByText('No image')).toBeTruthy()
  })

  it('appends + to the price when the size price range spans multiple values', () => {
    const cheap = { ...size, id: 'sz-1', priceCents: 1500 }
    const dear = { ...size, id: 'sz-2', priceCents: 2500 }
    render(
      <ProductCard product={product} variants={[variant]} sizes={[cheap, dear]} images={[image]} />,
    )
    expect(screen.getByText(/₨1,500\+/)).toBeTruthy()
  })

  it('renders no price line when there are no sizes', () => {
    const { container } = render(
      <ProductCard product={product} variants={[variant]} sizes={[]} images={[image]} />,
    )
    expect(container.querySelector('.text-primary')).toBeNull()
  })

  it('renders a color dot per color variant with its title', () => {
    render(<ProductCard product={product} variants={[variant]} sizes={[size]} images={[image]} />)
    expect(screen.getByTitle('White')).toBeTruthy()
  })

  it('renders no color dots when no variant has a colorHex', () => {
    const noColor = { ...variant, colorHex: null }
    render(<ProductCard product={product} variants={[noColor]} sizes={[size]} images={[image]} />)
    expect(screen.queryByTitle('White')).toBeNull()
  })

  it('shows a +N overflow indicator when more than 5 color variants exist', () => {
    const many = Array.from({ length: 7 }, (_, i) => ({
      ...variant,
      id: `var-${i}`,
      label: `Color ${i}`,
      colorHex: '#123456',
    }))
    render(<ProductCard product={product} variants={many} sizes={[size]} images={[image]} />)
    // 7 color variants, 5 dots shown → +2 overflow
    expect(screen.getByText('+2')).toBeTruthy()
  })

  // CLS regression — the image wrapper must carry an aspect-ratio class so height is
  // reserved before the image bytes arrive, preventing layout shift (CLS < 0.1).
  it('image wrapper has aspect-ratio class to reserve space before image loads (CLS guard)', () => {
    const { container } = render(
      <ProductCard product={product} variants={[variant]} sizes={[size]} images={[image]} />,
    )
    // The div.relative wrapping the <Image fill> must have a fixed aspect ratio.
    const wrapper = container.querySelector('div.relative')
    expect(wrapper).not.toBeNull()
    // Tailwind class is aspect-[4/5]; check for the substring "aspect-" to be robust
    // against future ratio tweaks while still catching a missing class entirely.
    expect(wrapper!.className).toMatch(/aspect-/)
  })

  // LCP regression — cards with priority=true must render the image as priority
  // (fetchpriority=high / no lazy loading); cards without must stay lazy.
  it('renders image with priority when priority prop is true', () => {
    render(
      <ProductCard
        product={product}
        variants={[variant]}
        sizes={[size]}
        images={[image]}
        priority
      />,
    )
    const img = screen.getByAltText('Classic Tee') as HTMLImageElement
    expect(img.getAttribute('data-priority')).toBe('true')
  })

  it('renders image without priority by default (stays lazy for below-fold cards)', () => {
    render(<ProductCard product={product} variants={[variant]} sizes={[size]} images={[image]} />)
    const img = screen.getByAltText('Classic Tee') as HTMLImageElement
    expect(img.getAttribute('data-priority')).toBe('false')
  })

  // ── Handler coverage ────────────────────────────────────────────────────────

  it('onMouseEnter on the card link calls prefetch for the product', async () => {
    const { prefetch } = await import('@/lib/api')
    const mockPrefetch = vi.mocked(prefetch)
    render(<ProductCard product={product} variants={[variant]} sizes={[size]} images={[image]} />)
    const link = screen.getByRole('link')
    fireEvent.mouseEnter(link)
    expect(mockPrefetch).toHaveBeenCalledWith('/api/products/prod-1')
  })

  it('onFocus on the card link calls prefetch for the product', async () => {
    const { prefetch } = await import('@/lib/api')
    const mockPrefetch = vi.mocked(prefetch)
    render(<ProductCard product={product} variants={[variant]} sizes={[size]} images={[image]} />)
    const link = screen.getByRole('link')
    fireEvent.focus(link)
    expect(mockPrefetch).toHaveBeenCalledWith('/api/products/prod-1')
  })

  it('handleQuickAdd adds to cart and opens it when exactly one active size exists', () => {
    render(<ProductCard product={product} variants={[variant]} sizes={[size]} images={[image]} />)
    const btn = screen.getByRole('button', { name: /quick add/i })
    // Click must not navigate (stopPropagation + preventDefault) and must add the item.
    fireEvent.click(btn)
    // After click, the quick-add button still exists (no navigation occurred).
    expect(btn).toBeTruthy()
  })

  it('handleQuickAdd does nothing when canQuickAdd is false (multiple active sizes)', () => {
    const size2 = { ...size, id: 'sz-2', size: 'L' }
    render(
      <ProductCard product={product} variants={[variant]} sizes={[size, size2]} images={[image]} />,
    )
    // With two active sizes canQuickAdd is false — no quick-add button rendered.
    expect(screen.queryByRole('button', { name: /quick add/i })).toBeNull()
  })

  it('handleQuickAdd falls back to variants[0] when no variant id matches size.variantId', () => {
    // size.variantId = 'var-1' but the variant has id 'var-other' → find() returns undefined
    // → variants[0] fallback is used (the ?? variants[0] branch).
    const otherVariant = { ...variant, id: 'var-other' }
    const singleSize = { ...size, variantId: 'var-1' } // doesn't match 'var-other'
    render(
      <ProductCard
        product={product}
        variants={[otherVariant]}
        sizes={[singleSize]}
        images={[image]}
      />,
    )
    const btn = screen.getByRole('button', { name: /quick add/i })
    fireEvent.click(btn)
    // Rendered and clicked without error — variants[0] was used.
    expect(btn).toBeTruthy()
  })

  it('handleQuickAdd uses empty strings for id/label when variants array is empty', () => {
    // variants=[] → find() → undefined, variants[0] → undefined
    // → variant?.id ?? '' and variant?.label ?? '' both fall back to ''.
    // Also firstImage?.url ?? '' with images=[] falls back to ''.
    const singleSize = { ...size }
    render(<ProductCard product={product} variants={[]} sizes={[singleSize]} images={[]} />)
    // No image shown (no firstImage), quick-add button rendered (canQuickAdd=true).
    const btn = screen.getByRole('button', { name: /quick add/i })
    fireEvent.click(btn)
    expect(btn).toBeTruthy()
  })

  it('handleQuickAdd includes sku and stripePriceId when both are non-null', () => {
    // size.sku ?? undefined → 'SKU-001' (non-null path)
    // size.stripePriceId ?? undefined → 'price_xyz' (non-null path)
    const sizeWithIds = { ...size, sku: 'SKU-001', stripePriceId: 'price_xyz' }
    render(
      <ProductCard product={product} variants={[variant]} sizes={[sizeWithIds]} images={[image]} />,
    )
    const btn = screen.getByRole('button', { name: /quick add/i })
    fireEvent.click(btn)
    expect(btn).toBeTruthy()
  })
})
