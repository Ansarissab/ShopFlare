import { describe, it, expect } from 'vitest'
import {
  productJsonLd,
  aggregateRatingJsonLd,
  organizationJsonLd,
  breadcrumbListJsonLd,
  collectionPageJsonLd,
  faqPageJsonLd,
  articleJsonLd,
  offerJsonLd,
} from './jsonld'
import type { ProductWithVariants } from '@/lib/types/product'

// Minimal product fixture
function makeProduct(opts: { minPrice?: number; maxPrice?: number; stock?: number } = {}): ProductWithVariants {
  const stock = opts.stock ?? 10
  return {
    product: { id: 'p1', name: 'Test Product', description: 'A product', slug: 'test-product', active: true, stripeProductId: null, createdAt: '', updatedAt: '' } as unknown as ProductWithVariants['product'],
    variants: [
      {
        id: 'v1',
        productId: 'p1',
        label: 'Default',
        colorHex: null,
        sortOrder: 0,
        images: [{ id: 'i1', variantId: 'v1', url: 'https://example.com/img.jpg', r2Key: 'k', sortOrder: 0 }],
        sizes: [
          { id: 's1', variantId: 'v1', label: 'S', priceCents: opts.minPrice ?? 1000, stock, active: true, sku: null, sortOrder: 0 },
          ...(opts.maxPrice && opts.maxPrice !== opts.minPrice
            ? [{ id: 's2', variantId: 'v1', label: 'L', priceCents: opts.maxPrice, stock, active: true, sku: null, sortOrder: 1 }]
            : []),
        ],
      } as unknown as ProductWithVariants['variants'][0],
    ],
    categoryIds: [],
  }
}

describe('productJsonLd', () => {
  it('builds Product schema with @context and @type', () => {
    const result = productJsonLd(makeProduct())
    expect(result['@context']).toBe('https://schema.org')
    expect(result['@type']).toBe('Product')
    expect(result.name).toBe('Test Product')
  })

  it('includes images from variants', () => {
    const result = productJsonLd(makeProduct())
    expect(result.image).toEqual(['https://example.com/img.jpg'])
  })

  it('uses Offer for single price', () => {
    const result = productJsonLd(makeProduct({ minPrice: 1000 }))
    const offers = result.offers as Record<string, unknown>
    expect(offers['@type']).toBe('Offer')
    expect(offers.price).toBe(1000) // PKR has 0 decimals, divisor=1, so 1000 cents = 1000
  })

  it('uses AggregateOffer when price range exists', () => {
    const result = productJsonLd(makeProduct({ minPrice: 1000, maxPrice: 2000 }))
    const offers = result.offers as Record<string, unknown>
    expect(offers['@type']).toBe('AggregateOffer')
    expect(offers.lowPrice).toBeLessThan(offers.highPrice as number)
  })

  it('marks out-of-stock correctly', () => {
    const result = productJsonLd(makeProduct({ stock: 0 }))
    const offers = result.offers as Record<string, unknown>
    expect(offers.availability).toBe('https://schema.org/OutOfStock')
  })

  it('includes aggregateRating when rating provided', () => {
    const result = productJsonLd(makeProduct(), { rating: { average: 4.5, count: 12 } })
    const rating = result.aggregateRating as Record<string, unknown>
    expect(rating['@type']).toBe('AggregateRating')
    expect(rating.ratingValue).toBe(4.5)
    expect(rating.reviewCount).toBe(12)
  })

  it('skips aggregateRating when count is 0', () => {
    const result = productJsonLd(makeProduct(), { rating: { average: 0, count: 0 } })
    expect(result.aggregateRating).toBeUndefined()
  })

  it('includes brand when storeName provided', () => {
    const result = productJsonLd(makeProduct(), { storeName: 'Acme' })
    const brand = result.brand as Record<string, unknown>
    expect(brand.name).toBe('Acme')
  })
})

describe('aggregateRatingJsonLd', () => {
  it('builds AggregateRating schema', () => {
    const r = aggregateRatingJsonLd({ average: 4.2, count: 5 })
    expect(r['@type']).toBe('AggregateRating')
    expect(r.ratingValue).toBe(4.2)
    expect(r.reviewCount).toBe(5)
  })
})

describe('organizationJsonLd', () => {
  it('builds Organization with name', () => {
    const r = organizationJsonLd({ name: 'Acme' })
    expect(r['@type']).toBe('Organization')
    expect(r.name).toBe('Acme')
  })

  it('includes logo and email when provided', () => {
    const r = organizationJsonLd({ name: 'Acme', logoUrl: 'https://logo.jpg', email: 'hi@acme.com' })
    expect(r.logo).toBe('https://logo.jpg')
    expect(r.email).toBe('hi@acme.com')
  })
})

describe('breadcrumbListJsonLd', () => {
  it('builds BreadcrumbList with positions', () => {
    const r = breadcrumbListJsonLd([
      { name: 'Home', url: 'https://example.com/' },
      { name: 'Shoes', url: 'https://example.com/shoes' },
    ])
    const items = r.itemListElement as Array<Record<string, unknown>>
    expect(items[0].position).toBe(1)
    expect(items[1].position).toBe(2)
    expect(items[1].name).toBe('Shoes')
  })

  it('omits item key when url is null', () => {
    const r = breadcrumbListJsonLd([{ name: 'Current', url: null }])
    const items = r.itemListElement as Array<Record<string, unknown>>
    expect(items[0].item).toBeUndefined()
  })
})

describe('collectionPageJsonLd', () => {
  it('builds CollectionPage schema', () => {
    const r = collectionPageJsonLd({ name: 'Shoes', url: 'https://example.com/shoes' })
    expect(r['@type']).toBe('CollectionPage')
    expect(r.name).toBe('Shoes')
  })
})

describe('faqPageJsonLd', () => {
  it('builds FAQPage with questions', () => {
    const r = faqPageJsonLd([{ question: 'Q?', answer: 'A.' }])
    expect(r['@type']).toBe('FAQPage')
    const entities = r.mainEntity as Array<Record<string, unknown>>
    expect(entities[0]['@type']).toBe('Question')
  })
})

describe('articleJsonLd', () => {
  it('builds Article schema', () => {
    const r = articleJsonLd({ title: 'Post', url: 'https://blog.com/1' })
    expect(r['@type']).toBe('Article')
    expect(r.headline).toBe('Post')
  })
})

describe('offerJsonLd', () => {
  it('builds Offer with InStock availability', () => {
    const r = offerJsonLd({ price: 9.99, currency: 'USD', availability: 'InStock' })
    expect(r['@type']).toBe('Offer')
    expect(r.availability).toContain('InStock')
  })
})
