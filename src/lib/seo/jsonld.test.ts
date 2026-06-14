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
function makeProduct(
  opts: { minPrice?: number; maxPrice?: number; stock?: number } = {},
): ProductWithVariants {
  const stock = opts.stock ?? 10
  return {
    product: {
      id: 'p1',
      name: 'Test Product',
      description: 'A product',
      slug: 'test-product',
      active: true,
      stripeProductId: null,
      faqItems: null,
      createdAt: '',
      updatedAt: '',
    } as unknown as ProductWithVariants['product'],
    variants: [
      {
        id: 'v1',
        productId: 'p1',
        label: 'Default',
        colorHex: null,
        sortOrder: 0,
        images: [
          {
            id: 'i1',
            variantId: 'v1',
            url: 'https://example.com/img.jpg',
            r2Key: 'k',
            sortOrder: 0,
          },
        ],
        sizes: [
          {
            id: 's1',
            variantId: 'v1',
            label: 'S',
            priceCents: opts.minPrice ?? 1000,
            stock,
            active: true,
            sku: null,
            sortOrder: 0,
          },
          ...(opts.maxPrice && opts.maxPrice !== opts.minPrice
            ? [
                {
                  id: 's2',
                  variantId: 'v1',
                  label: 'L',
                  priceCents: opts.maxPrice,
                  stock,
                  active: true,
                  sku: null,
                  sortOrder: 1,
                },
              ]
            : []),
        ],
      } as unknown as ProductWithVariants['variants'][0],
    ],
    categoryIds: [],
    faqItems: [],
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

  it('uses provided currency for offer priceCurrency', () => {
    const result = productJsonLd(makeProduct({ minPrice: 1000 }), { currency: 'USD' })
    const offers = result.offers as Record<string, unknown>
    expect(offers.priceCurrency).toBe('USD')
  })

  it('falls back to DEFAULT_CURRENCY meta when unknown currency provided', () => {
    // covers CURRENCIES['XYZ'] ?? CURRENCIES[DEFAULT_CURRENCY] right-hand branch
    const result = productJsonLd(makeProduct(), { currency: 'XYZ' as string })
    expect(result['@type']).toBe('Product')
  })

  it('omits images when all variant image urls are empty', () => {
    const item = makeProduct()
    ;(item.variants[0] as unknown as Record<string, unknown>).images = [
      { id: 'i1', variantId: 'v1', url: '', r2Key: 'k', sortOrder: 0 },
    ]
    const result = productJsonLd(item)
    expect(result.image).toBeUndefined()
  })

  it('omits description when product has none', () => {
    const item = makeProduct()
    ;(item as unknown as Record<string, unknown>).product = { ...item.product, description: null }
    const result = productJsonLd(item)
    expect(result.description).toBeUndefined()
  })

  it('includes url in Offer when storeUrl provided', () => {
    const result = productJsonLd(makeProduct({ minPrice: 1000 }), { storeUrl: 'https://shop.test' })
    const offers = result.offers as Record<string, unknown>
    expect(offers.url).toBe('https://shop.test/product/p1')
  })

  it('includes url in AggregateOffer when storeUrl provided', () => {
    const result = productJsonLd(makeProduct({ minPrice: 1000, maxPrice: 2000 }), {
      storeUrl: 'https://shop.test',
    })
    const offers = result.offers as Record<string, unknown>
    expect(offers['@type']).toBe('AggregateOffer')
    expect(offers.url).toBe('https://shop.test/product/p1')
  })

  it('emits null-price Offer when product has no sizes', () => {
    const item: ProductWithVariants = {
      ...makeProduct(),
      variants: [
        {
          id: 'v1',
          productId: 'p1',
          label: 'Default',
          colorHex: null,
          sortOrder: 0,
          images: [],
          sizes: [],
        } as unknown as ProductWithVariants['variants'][0],
      ],
    }
    const result = productJsonLd(item)
    const offers = result.offers as Record<string, unknown>
    expect(offers['@type']).toBe('Offer')
    expect(offers.price).toBeUndefined()
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
    const r = organizationJsonLd({
      name: 'Acme',
      logoUrl: 'https://logo.jpg',
      email: 'hi@acme.com',
    })
    expect(r.logo).toBe('https://logo.jpg')
    expect(r.email).toBe('hi@acme.com')
  })

  it('includes url when provided', () => {
    const r = organizationJsonLd({ name: 'Acme', url: 'https://acme.com' })
    expect(r.url).toBe('https://acme.com')
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

  it('includes description and imageUrl when provided', () => {
    const r = collectionPageJsonLd({
      name: 'Shoes',
      url: 'https://example.com/shoes',
      description: 'Best shoes',
      imageUrl: 'https://img.jpg',
    })
    expect(r.description).toBe('Best shoes')
    expect(r.image).toBe('https://img.jpg')
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

  it('includes all optional fields when provided', () => {
    const r = articleJsonLd({
      title: 'Post',
      url: 'https://blog.com/1',
      description: 'Desc',
      imageUrl: 'https://img.jpg',
      datePublished: '2024-01-01',
      dateModified: '2024-01-02',
      authorName: 'Alice',
    })
    expect(r.description).toBe('Desc')
    expect(r.image).toBe('https://img.jpg')
    expect(r.datePublished).toBe('2024-01-01')
    expect(r.dateModified).toBe('2024-01-02')
    expect((r.author as Record<string, unknown>).name).toBe('Alice')
  })
})

describe('offerJsonLd', () => {
  it('builds Offer with InStock availability', () => {
    const r = offerJsonLd({ price: 9.99, currency: 'USD', availability: 'InStock' })
    expect(r['@type']).toBe('Offer')
    expect(r.availability).toContain('InStock')
  })

  it('includes url when provided', () => {
    const r = offerJsonLd({
      price: 9.99,
      currency: 'USD',
      availability: 'InStock',
      url: 'https://shop.com/p1',
    })
    expect(r.url).toBe('https://shop.com/p1')
  })
})
