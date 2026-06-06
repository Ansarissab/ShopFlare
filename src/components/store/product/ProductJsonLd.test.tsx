// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor, cleanup } from '@testing-library/react'
import { ProductJsonLd } from './ProductJsonLd'
import type { ProductWithVariants, SizeOption, ProductImage } from '@/lib/types/product'

const apiGet = vi.fn()
vi.mock('@/lib/api', () => ({
  apiGet: (path: string) => apiGet(path),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function size(id: string, priceCents: number, stock: number, active = true): SizeOption {
  return { id, variantId: 'v1', size: id, sku: null, priceCents, stock, stripePriceId: null, active }
}

function img(url: string): ProductImage {
  return { id: url, variantId: 'v1', url, r2Key: url, sortOrder: 0 }
}

function makeItem(overrides?: { sizes?: SizeOption[]; images?: ProductImage[]; name?: string; description?: string | null }): ProductWithVariants {
  return {
    product: {
      id: 'prod-1',
      name: overrides?.name ?? 'Hoodie',
      description: (overrides?.description === undefined ? 'Warm hoodie' : overrides.description) as string,
      active: true,
      stripeProductId: null,
      createdAt: '2024-01-01 00:00:00',
      updatedAt: '2024-01-01 00:00:00',
    },
    categoryIds: [],
    variants: [
      {
        id: 'v1',
        productId: 'prod-1',
        label: 'Red',
        colorHex: '#f00',
        sortOrder: 0,
        images: overrides?.images ?? [img('/a.jpg'), img('/b.jpg')],
        sizes: overrides?.sizes ?? [size('s1', 1000, 5), size('s2', 1500, 3)],
      },
    ],
  }
}

// Reads + parses the emitted JSON-LD script tag.
function readJsonLd(container: HTMLElement): Record<string, unknown> {
  const script = container.querySelector('script[type="application/ld+json"]')!
  return JSON.parse(script.textContent ?? script.innerHTML)
}

function mockApi(config: Record<string, unknown> | Error, reviews: Record<string, unknown> | Error) {
  apiGet.mockImplementation((path: string) => {
    if (path === '/api/config/store') {
      return config instanceof Error ? Promise.reject(config) : Promise.resolve(config)
    }
    return reviews instanceof Error ? Promise.reject(reviews) : Promise.resolve(reviews)
  })
}

describe('ProductJsonLd', () => {
  beforeEach(() => {
    mockApi({ currency: 'USD' }, { reviews: [], average: 0, count: 0 })
  })

  it('renders null until data is ready', () => {
    // first synchronous render returns null (ready=false)
    apiGet.mockImplementation(() => new Promise(() => {}))
    const { container } = render(<ProductJsonLd item={makeItem()} />)
    expect(container.querySelector('script')).toBeNull()
  })

  it('emits an AggregateOffer for a price range with the fetched currency', async () => {
    const { container } = render(<ProductJsonLd item={makeItem()} storeUrl="https://shop.test" storeName="MyShop" />)
    await waitFor(() => expect(container.querySelector('script')).toBeTruthy())
    const ld = readJsonLd(container)
    const offers = ld.offers as Record<string, unknown>
    expect(offers['@type']).toBe('AggregateOffer')
    // USD has 2 decimals → 1000c = 10, 1500c = 15
    expect(offers.lowPrice).toBe(10)
    expect(offers.highPrice).toBe(15)
    expect(offers.offerCount).toBe(2)
    expect(offers.priceCurrency).toBe('USD')
    expect(offers.availability).toBe('https://schema.org/InStock')
    expect(offers.url).toBe('https://shop.test/product/prod-1')
    expect(ld.brand).toEqual({ '@type': 'Brand', name: 'MyShop' })
    expect(ld.image).toEqual(['/a.jpg', '/b.jpg'])
    expect(ld.name).toBe('Hoodie')
    expect(ld.description).toBe('Warm hoodie')
  })

  it('emits a single Offer when all active sizes share one price', async () => {
    const { container } = render(
      <ProductJsonLd item={makeItem({ sizes: [size('s1', 1000, 5), size('s2', 1000, 2)] })} />,
    )
    await waitFor(() => expect(container.querySelector('script')).toBeTruthy())
    const offers = readJsonLd(container).offers as Record<string, unknown>
    expect(offers['@type']).toBe('Offer')
    expect(offers.price).toBe(10)
    expect(offers.url).toBeUndefined()
  })

  it('emits an Offer with availability only when no priced active sizes', async () => {
    const { container } = render(
      <ProductJsonLd item={makeItem({ sizes: [size('s1', 1000, 0)], images: [] })} />,
    )
    await waitFor(() => expect(container.querySelector('script')).toBeTruthy())
    const ld = readJsonLd(container)
    const offers = ld.offers as Record<string, unknown>
    expect(offers['@type']).toBe('Offer')
    expect(offers.price).toBeUndefined()
    expect(offers.availability).toBe('https://schema.org/OutOfStock')
    // no images → image key omitted
    expect(ld.image).toBeUndefined()
  })

  it('falls back to default currency (PKR, 0 decimals) when config fetch fails', async () => {
    mockApi(new Error('down'), { reviews: [], average: 0, count: 0 })
    const { container } = render(<ProductJsonLd item={makeItem()} />)
    await waitFor(() => expect(container.querySelector('script')).toBeTruthy())
    const offers = readJsonLd(container).offers as Record<string, unknown>
    expect(offers.priceCurrency).toBe('PKR')
    // PKR 0 decimals → divisor 1, so prices stay as cents
    expect(offers.lowPrice).toBe(1000)
    expect(offers.highPrice).toBe(1500)
  })

  it('uses default currency when config returns no currency field', async () => {
    mockApi({}, { reviews: [], average: 0, count: 0 })
    const { container } = render(<ProductJsonLd item={makeItem()} />)
    await waitFor(() => expect(container.querySelector('script')).toBeTruthy())
    expect((readJsonLd(container).offers as Record<string, unknown>).priceCurrency).toBe('PKR')
  })

  it('adds aggregateRating from the reviews API when caller passes none', async () => {
    mockApi({ currency: 'USD' }, { reviews: [], average: 4.2, count: 7 })
    const { container } = render(<ProductJsonLd item={makeItem()} />)
    await waitFor(() => expect(container.querySelector('script')).toBeTruthy())
    expect(readJsonLd(container).aggregateRating).toEqual({
      '@type': 'AggregateRating',
      ratingValue: 4.2,
      reviewCount: 7,
    })
  })

  it('does not add aggregateRating when reviews API returns count 0', async () => {
    mockApi({ currency: 'USD' }, { reviews: [], average: 0, count: 0 })
    const { container } = render(<ProductJsonLd item={makeItem()} />)
    await waitFor(() => expect(container.querySelector('script')).toBeTruthy())
    expect(readJsonLd(container).aggregateRating).toBeUndefined()
  })

  it('prefers the rating prop over the reviews API', async () => {
    // reviews API would yield 4.2/7 but caller passes 3/10 — API ignored
    mockApi({ currency: 'USD' }, { reviews: [], average: 4.2, count: 7 })
    const { container } = render(
      <ProductJsonLd item={makeItem()} rating={{ average: 3, count: 10 }} />,
    )
    await waitFor(() => expect(container.querySelector('script')).toBeTruthy())
    expect(readJsonLd(container).aggregateRating).toEqual({
      '@type': 'AggregateRating',
      ratingValue: 3,
      reviewCount: 10,
    })
  })

  it('still renders when the reviews API fails (rating omitted)', async () => {
    mockApi({ currency: 'USD' }, new Error('reviews down'))
    const { container } = render(<ProductJsonLd item={makeItem()} />)
    await waitFor(() => expect(container.querySelector('script')).toBeTruthy())
    expect(readJsonLd(container).aggregateRating).toBeUndefined()
  })

  it('omits description from JSON-LD when product has none', async () => {
    const { container } = render(<ProductJsonLd item={makeItem({ description: null })} />)
    await waitFor(() => expect(container.querySelector('script')).toBeTruthy())
    expect(readJsonLd(container).description).toBeUndefined()
  })

  it('escapes < in the serialized JSON to prevent script breakout', async () => {
    const { container } = render(
      <ProductJsonLd item={makeItem({ name: 'Bad</script>Name' })} />,
    )
    await waitFor(() => expect(container.querySelector('script')).toBeTruthy())
    const raw = container.querySelector('script')!.innerHTML
    expect(raw).not.toContain('</script>')
    expect(raw).toContain('\\u003c')
  })

  it('skips images with an empty url', async () => {
    const { container } = render(
      <ProductJsonLd item={makeItem({ images: [img('/a.jpg'), img('')] })} />,
    )
    await waitFor(() => expect(container.querySelector('script')).toBeTruthy())
    // empty-url image filtered out → only the one real url remains
    expect(readJsonLd(container).image).toEqual(['/a.jpg'])
  })

  it('omits brand when storeName is not given', async () => {
    const { container } = render(<ProductJsonLd item={makeItem()} />)
    await waitFor(() => expect(container.querySelector('script')).toBeTruthy())
    expect(readJsonLd(container).brand).toBeUndefined()
  })

  it('includes the product url on a single Offer when storeUrl is set', async () => {
    const { container } = render(
      <ProductJsonLd
        item={makeItem({ sizes: [size('s1', 1000, 5), size('s2', 1000, 2)] })}
        storeUrl="https://shop.test"
      />,
    )
    await waitFor(() => expect(container.querySelector('script')).toBeTruthy())
    const offers = readJsonLd(container).offers as Record<string, unknown>
    expect(offers['@type']).toBe('Offer')
    expect(offers.url).toBe('https://shop.test/product/prod-1')
  })

  it('includes the product url on the no-price Offer when storeUrl is set', async () => {
    const { container } = render(
      <ProductJsonLd
        item={makeItem({ sizes: [size('s1', 1000, 0)], images: [] })}
        storeUrl="https://shop.test"
      />,
    )
    await waitFor(() => expect(container.querySelector('script')).toBeTruthy())
    const offers = readJsonLd(container).offers as Record<string, unknown>
    expect(offers.price).toBeUndefined()
    expect(offers.url).toBe('https://shop.test/product/prod-1')
  })
})
