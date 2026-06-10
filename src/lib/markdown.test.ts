import { describe, it, expect } from 'vitest'
import { productToMarkdown, categoryToMarkdown, policyToMarkdown } from './markdown'
import type { ProductWithVariants } from './types/product'
import type { CategoryDetailResponse } from './types/category'
import type { StorePage } from './types/admin'
import type { StoreConfig } from './types/common'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const mockConfig = {
  storeName: 'TestShop',
  currency: 'USD',
  freeShippingThresholdCents: 0,
  flatShippingRateCents: 0,
} as unknown as StoreConfig

function makeProduct(
  opts: {
    name?: string
    description?: string | null
    stock?: number
    minPrice?: number
    maxPrice?: number
    active?: boolean
  } = {},
): ProductWithVariants {
  const stock = opts.stock ?? 10
  const minPrice = opts.minPrice ?? 2000
  const maxPrice = opts.maxPrice ?? minPrice

  const sizes: ProductWithVariants['variants'][0]['sizes'] = [
    {
      id: 's1',
      variantId: 'v1',
      label: 'M',
      priceCents: minPrice,
      stock,
      active: true,
      sku: null,
      sortOrder: 0,
    } as unknown as ProductWithVariants['variants'][0]['sizes'][0],
  ]
  if (maxPrice !== minPrice) {
    sizes.push({
      id: 's2',
      variantId: 'v1',
      label: 'XL',
      priceCents: maxPrice,
      stock,
      active: true,
      sku: null,
      sortOrder: 1,
    } as unknown as ProductWithVariants['variants'][0]['sizes'][0])
  }

  return {
    product: {
      id: 'p1',
      name: opts.name ?? 'Cool Sneakers',
      description: opts.description !== undefined ? opts.description : '<p>Great shoes</p>',
      slug: 'cool-sneakers',
      active: opts.active ?? true,
      stripeProductId: null,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-02',
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
            url: 'https://cdn.test/img.jpg',
            r2Key: 'key',
            sortOrder: 0,
          },
        ],
        sizes,
      } as unknown as ProductWithVariants['variants'][0],
    ],
    categoryIds: [],
  }
}

function makeCategoryDetail(
  opts: {
    name?: string
    description?: string | null
    productCount?: number
  } = {},
): CategoryDetailResponse {
  const count = opts.productCount ?? 2
  const products: ProductWithVariants[] = Array.from({ length: count }, (_, i) =>
    makeProduct({ name: `Product ${i + 1}` }),
  )
  return {
    category: {
      id: 'cat1',
      name: opts.name ?? 'Footwear',
      slug: 'footwear',
      description: opts.description !== undefined ? opts.description : '<b>Best shoes</b>',
      parentId: null,
      imageUrl: null,
      imageR2Key: null,
      sortOrder: 0,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-02',
    } as unknown as CategoryDetailResponse['category'],
    products,
    breadcrumb: [],
  }
}

function makeStorePage(
  opts: {
    title?: string
    content?: string
    updatedAt?: string
  } = {},
): StorePage {
  return {
    slug: 'shipping',
    title: opts.title ?? 'Shipping Policy',
    content: opts.content ?? '<p>We ship worldwide.</p>',
    updatedAt: opts.updatedAt ?? '2024-06-01',
  }
}

// ─── productToMarkdown ────────────────────────────────────────────────────────

describe('productToMarkdown', () => {
  it('includes product name as h1', () => {
    const md = productToMarkdown(makeProduct({ name: 'Air Max 90' }), mockConfig, { siteUrl: '' })
    expect(md).toContain('# Air Max 90')
  })

  it('strips HTML from description', () => {
    const md = productToMarkdown(
      makeProduct({ description: '<p>Great <b>shoes</b></p>' }),
      mockConfig,
      { siteUrl: '' },
    )
    expect(md).toContain('Great shoes')
    expect(md).not.toContain('<p>')
    expect(md).not.toContain('<b>')
  })

  it('omits description section when description is null', () => {
    const md = productToMarkdown(makeProduct({ description: null }), mockConfig, { siteUrl: '' })
    // h1 still present, no trailing blank lines from description
    expect(md).toContain('# Cool Sneakers')
    expect(md).not.toContain('null')
  })

  it('shows single price when min === max', () => {
    const md = productToMarkdown(makeProduct({ minPrice: 1999 }), mockConfig, { siteUrl: '' })
    expect(md).toContain('**Price:** USD 19.99')
  })

  it('shows price range when min !== max', () => {
    const md = productToMarkdown(makeProduct({ minPrice: 1000, maxPrice: 3000 }), mockConfig, {
      siteUrl: '',
    })
    expect(md).toContain('USD 10.00 – USD 30.00')
  })

  it('shows In Stock when stock > 0', () => {
    const md = productToMarkdown(makeProduct({ stock: 5 }), mockConfig, { siteUrl: '' })
    expect(md).toContain('**Availability:** In Stock')
  })

  it('shows Out of Stock when all sizes have stock 0', () => {
    const md = productToMarkdown(makeProduct({ stock: 0 }), mockConfig, { siteUrl: '' })
    expect(md).toContain('**Availability:** Out of Stock')
  })

  it('links to product URL when siteUrl provided', () => {
    const md = productToMarkdown(makeProduct(), mockConfig, { siteUrl: 'https://shop.test' })
    expect(md).toContain('[View product](https://shop.test/product/p1)')
  })

  it('omits view-product link when siteUrl is empty string', () => {
    const md = productToMarkdown(makeProduct(), mockConfig, { siteUrl: '' })
    expect(md).not.toContain('[View product]')
  })

  it('omits price block when product has no active sizes with non-zero stock', () => {
    const md = productToMarkdown(makeProduct({ stock: 0 }), mockConfig, { siteUrl: '' })
    expect(md).not.toContain('**Price:**')
  })

  it('uses config currency (PKR) when provided', () => {
    const pkrConfig = { ...mockConfig, currency: 'PKR' } as unknown as StoreConfig
    // PKR has 0 decimals — price 1000 cents → 1000 PKR
    const md = productToMarkdown(makeProduct({ minPrice: 100000 }), pkrConfig, { siteUrl: '' })
    expect(md).toContain('PKR')
  })

  it('falls back to USD when config is null', () => {
    const md = productToMarkdown(makeProduct({ minPrice: 500 }), null, { siteUrl: '' })
    expect(md).toContain('USD')
  })

  it('handles product with no variants gracefully (no prices, out of stock)', () => {
    const item: ProductWithVariants = { ...makeProduct(), variants: [] }
    const md = productToMarkdown(item, mockConfig, { siteUrl: '' })
    expect(md).toContain('# Cool Sneakers')
    expect(md).toContain('Out of Stock')
    expect(md).not.toContain('**Price:**')
  })
})

// ─── categoryToMarkdown ───────────────────────────────────────────────────────

describe('categoryToMarkdown', () => {
  it('includes category name as h1', () => {
    const md = categoryToMarkdown(makeCategoryDetail({ name: 'Sneakers' }), mockConfig, {
      siteUrl: '',
    })
    expect(md).toContain('# Sneakers')
  })

  it('strips HTML from category description', () => {
    const md = categoryToMarkdown(
      makeCategoryDetail({ description: '<b>Best shoes</b>' }),
      mockConfig,
      { siteUrl: '' },
    )
    expect(md).toContain('Best shoes')
    expect(md).not.toContain('<b>')
  })

  it('omits description when null', () => {
    const md = categoryToMarkdown(makeCategoryDetail({ description: null }), mockConfig, {
      siteUrl: '',
    })
    expect(md).toContain('# ')
    expect(md).not.toContain('null')
  })

  it('shows product count', () => {
    const md = categoryToMarkdown(makeCategoryDetail({ productCount: 3 }), mockConfig, {
      siteUrl: '',
    })
    expect(md).toContain('**Products:** 3')
  })

  it('lists products as markdown links when siteUrl provided', () => {
    const md = categoryToMarkdown(makeCategoryDetail({ productCount: 2 }), mockConfig, {
      siteUrl: 'https://shop.test',
    })
    expect(md).toContain('[Product 1](https://shop.test/product/p1)')
    expect(md).toContain('[Product 2](https://shop.test/product/p1)')
  })

  it('lists products as plain names when siteUrl is empty', () => {
    const md = categoryToMarkdown(makeCategoryDetail({ productCount: 2 }), mockConfig, {
      siteUrl: '',
    })
    expect(md).toContain('- Product 1')
    expect(md).not.toContain('](')
  })

  it('caps product listing at 20 items', () => {
    const md = categoryToMarkdown(makeCategoryDetail({ productCount: 25 }), mockConfig, {
      siteUrl: '',
    })
    // Only first 20 product lines should appear; product 21 should not
    const lines = md.split('\n').filter((l) => l.startsWith('- '))
    expect(lines.length).toBe(20)
  })

  it('handles empty product list', () => {
    const md = categoryToMarkdown(makeCategoryDetail({ productCount: 0 }), mockConfig, {
      siteUrl: '',
    })
    expect(md).toContain('**Products:** 0')
    const lines = md.split('\n').filter((l) => l.startsWith('- '))
    expect(lines.length).toBe(0)
  })
})

// ─── policyToMarkdown ─────────────────────────────────────────────────────────

describe('policyToMarkdown', () => {
  it('includes title as h1', () => {
    const md = policyToMarkdown(makeStorePage({ title: 'Returns Policy' }))
    expect(md).toContain('# Returns Policy')
  })

  it('shows updatedAt when present', () => {
    const md = policyToMarkdown(makeStorePage({ updatedAt: '2024-06-15' }))
    expect(md).toContain('*Last updated: 2024-06-15*')
  })

  it('strips HTML from content when content starts with a tag', () => {
    const md = policyToMarkdown(makeStorePage({ content: '<p>We ship <b>worldwide</b>.</p>' }))
    expect(md).toContain('We ship worldwide .')
    expect(md).not.toContain('<p>')
    expect(md).not.toContain('<b>')
  })

  it('shows plain text as-is when content does not start with a tag', () => {
    const md = policyToMarkdown(makeStorePage({ content: 'We ship worldwide.' }))
    expect(md).toContain('We ship worldwide.')
  })

  it('handles content with leading whitespace before an HTML tag', () => {
    // trimStart means "  <p>text" → starts with "<" after trim → strip HTML
    const md = policyToMarkdown(makeStorePage({ content: '   <p>Worldwide.</p>' }))
    expect(md).not.toContain('<p>')
    expect(md).toContain('Worldwide.')
  })

  it('omits content block when content is empty string', () => {
    const md = policyToMarkdown(makeStorePage({ content: '' }))
    // content is falsy — should not add a blank body line
    const lines = md.split('\n').filter(Boolean)
    // only h1 + updatedAt expected
    expect(lines.every((l) => !l.startsWith('<'))).toBe(true)
  })
})
