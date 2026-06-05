import { describe, it, expect } from 'vitest'
import type { ProductWithVariants } from '@/lib/types/product'
import type { CategoryNode } from '@/lib/types/category'
import {
  buildProductFuse,
  collectDescendantIds,
  filterProducts,
  paginate,
} from './productSearch'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function mkProduct(
  name: string,
  categoryIds: string[] = [],
  opts: { description?: string; variantLabels?: string[] } = {},
): ProductWithVariants {
  return {
    product: { id: name, name, description: opts.description ?? '' },
    variants: (opts.variantLabels ?? []).map((label) => ({ label })),
    categoryIds,
  } as unknown as ProductWithVariants
}

function mkNode(id: string, children: CategoryNode[] = []): CategoryNode {
  return { id, children } as unknown as CategoryNode
}

// ─── collectDescendantIds ─────────────────────────────────────────────────────

describe('collectDescendantIds', () => {
  const tree = [
    mkNode('men', [mkNode('shirts'), mkNode('pants')]),
    mkNode('women', [mkNode('dresses')]),
  ]

  it('returns the node itself plus all descendants for a parent', () => {
    expect(collectDescendantIds(tree, 'men')).toEqual(new Set(['men', 'shirts', 'pants']))
  })

  it('returns just the node for a leaf', () => {
    expect(collectDescendantIds(tree, 'shirts')).toEqual(new Set(['shirts']))
  })

  it('returns an empty set for a missing id', () => {
    expect(collectDescendantIds(tree, 'nope')).toEqual(new Set())
  })
})

// ─── filterProducts ───────────────────────────────────────────────────────────

describe('filterProducts', () => {
  const items = [
    mkProduct('Blue Shirt', ['shirts'], { variantLabels: ['Navy'] }),
    mkProduct('Red Hat', ['hats']),
    mkProduct('Green Shirt', ['shirts']),
  ]

  it('returns all items when no query and no category', () => {
    expect(filterProducts(items, { query: '', descendantIds: null })).toHaveLength(3)
  })

  it('finds by partial name match via Fuse', () => {
    const fuse = buildProductFuse(items)
    const result = filterProducts(items, { query: 'shirt', descendantIds: null, fuse })
    const names = result.map((r) => r.product.name).sort()
    expect(names).toEqual(['Blue Shirt', 'Green Shirt'])
  })

  it('matches on variant label', () => {
    const fuse = buildProductFuse(items)
    const result = filterProducts(items, { query: 'navy', descendantIds: null, fuse })
    expect(result.map((r) => r.product.name)).toEqual(['Blue Shirt'])
  })

  it('filters by category descendant ids', () => {
    const result = filterProducts(items, {
      query: '',
      descendantIds: new Set(['shirts']),
    })
    expect(result.map((r) => r.product.name).sort()).toEqual(['Blue Shirt', 'Green Shirt'])
  })

  it('ANDs query and category (combined narrows)', () => {
    const fuse = buildProductFuse(items)
    const result = filterProducts(items, {
      query: 'shirt',
      descendantIds: new Set(['shirts']),
      fuse,
    })
    // 'Red Hat' excluded by query; nothing in 'hats' survives the category filter
    expect(result.map((r) => r.product.name).sort()).toEqual(['Blue Shirt', 'Green Shirt'])
  })

  it('builds a Fuse index on demand when none is passed', () => {
    const result = filterProducts(items, { query: 'hat', descendantIds: null })
    expect(result.map((r) => r.product.name)).toEqual(['Red Hat'])
  })
})

// ─── paginate ─────────────────────────────────────────────────────────────────

describe('paginate', () => {
  const items = Array.from({ length: 25 }, (_, i) => i)

  it('returns the first page and reports hasMore', () => {
    const { visibleItems, hasMore } = paginate(items, 1, 10)
    expect(visibleItems).toHaveLength(10)
    expect(hasMore).toBe(true)
  })

  it('advances cumulatively with the page number', () => {
    const { visibleItems, hasMore } = paginate(items, 2, 10)
    expect(visibleItems).toHaveLength(20)
    expect(hasMore).toBe(true)
  })

  it('caps at the total and reports no more on the last page', () => {
    const { visibleItems, hasMore } = paginate(items, 3, 10)
    expect(visibleItems).toHaveLength(25)
    expect(hasMore).toBe(false)
  })

  it('has no more when everything fits in one page', () => {
    const { visibleItems, hasMore } = paginate(items, 1, 96)
    expect(visibleItems).toHaveLength(25)
    expect(hasMore).toBe(false)
  })
})
