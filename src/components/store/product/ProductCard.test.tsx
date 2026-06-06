// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ProductCard } from './ProductCard'

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) =>
    require('react').createElement('a', { href }, children),
}))

vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => {
    const { fill, priority, ...rest } = props
    return require('react').createElement('img', rest)
  },
}))

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
  sortOrder: 0,
}

describe('ProductCard', () => {
  it('renders product name', () => {
    render(
      <ProductCard
        product={product}
        variants={[variant]}
        sizes={[size]}
        images={[image]}
      />,
    )
    expect(screen.getByText('Classic Tee')).toBeTruthy()
  })

  it('renders formatted price', () => {
    render(
      <ProductCard
        product={product}
        variants={[variant]}
        sizes={[size]}
        images={[image]}
      />,
    )
    // 1500 PKR = ₨1,500
    expect(screen.getByText(/₨1,500/)).toBeTruthy()
  })

  it('links to product page with correct href', () => {
    render(
      <ProductCard
        product={product}
        variants={[variant]}
        sizes={[size]}
        images={[image]}
      />,
    )
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/product/prod-1')
  })

  it('renders product image with alt text', () => {
    render(
      <ProductCard
        product={product}
        variants={[variant]}
        sizes={[size]}
        images={[image]}
      />,
    )
    const img = screen.getByAltText('Classic Tee') as HTMLImageElement
    expect(img.src).toContain('/images/tee.jpg')
  })

  it('shows New badge when isNew is true', () => {
    render(
      <ProductCard
        product={product}
        variants={[variant]}
        sizes={[size]}
        images={[image]}
        isNew
      />,
    )
    expect(screen.getByText('New')).toBeTruthy()
  })

  it('shows out-of-stock when all sizes have zero stock', () => {
    const oosSize = { ...size, stock: 0 }
    render(
      <ProductCard
        product={product}
        variants={[variant]}
        sizes={[oosSize]}
        images={[image]}
      />,
    )
    expect(screen.getByText('Out of Stock')).toBeTruthy()
  })

  it('shows no-image placeholder when images array is empty', () => {
    render(
      <ProductCard
        product={product}
        variants={[variant]}
        sizes={[size]}
        images={[]}
      />,
    )
    expect(screen.getByText('No image')).toBeTruthy()
  })
})
