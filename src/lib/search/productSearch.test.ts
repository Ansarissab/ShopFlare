import { describe, it, expect } from 'vitest'
import type { ProductWithVariants } from '@/lib/types/product'
import type { CategoryNode } from '@/lib/types/category'
import type { ProductSearchItem } from '@/lib/types/search'
import {
  buildProductFuse,
  buildSearchFuse,
  collectDescendantIds,
  filterProducts,
  filterSearchItems,
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

  it('handles nodes whose children are undefined (?? [] fallback in addAll)', () => {
    // node with no `children` key at all → addAll must fall back to []
    const sparse = [{ id: 'solo' } as unknown as CategoryNode]
    expect(collectDescendantIds(sparse, 'solo')).toEqual(new Set(['solo']))
  })

  it('handles undefined children while walking past a non-target node (?? [] in walk)', () => {
    // First node has no children and is not the target → walk must recurse into []
    const sparse = [{ id: 'a' } as unknown as CategoryNode, mkNode('b', [mkNode('b-child')])]
    expect(collectDescendantIds(sparse, 'b')).toEqual(new Set(['b', 'b-child']))
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

// ─── filterSearchItems ────────────────────────────────────────────────────────

function mkSearchItem(
  id: string,
  name: string,
  opts: {
    description?: string | null
    categoryIds?: string[]
    inStock?: boolean
    variantLabels?: string[]
    priceCents?: number
  } = {},
): ProductSearchItem {
  return {
    id,
    name,
    description: opts.description ?? null,
    thumbnailUrl: null,
    priceCents: opts.priceCents ?? 1000,
    categoryIds: opts.categoryIds ?? [],
    inStock: opts.inStock ?? true,
    variantLabels: opts.variantLabels ?? [],
  }
}

describe('filterSearchItems', () => {
  const tree = [
    mkNode('men', [mkNode('shirts'), mkNode('pants')]),
    mkNode('women', [mkNode('dresses')]),
  ]

  const items: ProductSearchItem[] = [
    mkSearchItem('1', 'Blue Shirt', {
      categoryIds: ['shirts'],
      inStock: true,
      variantLabels: ['Navy'],
    }),
    mkSearchItem('2', 'Red Hat', { categoryIds: ['hats'], inStock: false }),
    mkSearchItem('3', 'Green Dress', { categoryIds: ['dresses'], inStock: true }),
    mkSearchItem('4', 'Black Pants', { categoryIds: ['pants'], inStock: true }),
    mkSearchItem('5', 'Out of Stock Shirt', { categoryIds: ['shirts'], inStock: false }),
  ]

  const noFilter = { query: '', categoryId: null, inStockOnly: false, categories: tree }

  it('returns all items with no filters applied', () => {
    expect(filterSearchItems(items, noFilter)).toHaveLength(5)
  })

  it('fuzzy query matches by name', () => {
    const result = filterSearchItems(items, { ...noFilter, query: 'shirt' })
    const ids = result.map((r) => r.id).sort()
    expect(ids).toEqual(['1', '5'])
  })

  it('fuzzy query matches by variant label', () => {
    const result = filterSearchItems(items, { ...noFilter, query: 'navy' })
    expect(result.map((r) => r.id)).toEqual(['1'])
  })

  it('inStockOnly filters out out-of-stock items', () => {
    const result = filterSearchItems(items, { ...noFilter, inStockOnly: true })
    expect(result.every((r) => r.inStock)).toBe(true)
    expect(result.map((r) => r.id).sort()).toEqual(['1', '3', '4'])
  })

  it('categoryId filters by category using descendant ids', () => {
    // 'men' → includes 'men', 'shirts', 'pants'
    const result = filterSearchItems(items, { ...noFilter, categoryId: 'men' })
    const ids = result.map((r) => r.id).sort()
    expect(ids).toEqual(['1', '4', '5'])
  })

  it('categoryId (leaf) filters to exact category', () => {
    const result = filterSearchItems(items, { ...noFilter, categoryId: 'dresses' })
    expect(result.map((r) => r.id)).toEqual(['3'])
  })

  it('ANDs query + category + inStockOnly', () => {
    const result = filterSearchItems(items, {
      query: 'shirt',
      categoryId: 'men',
      inStockOnly: true,
      categories: tree,
    })
    // shirts in 'men' subtree that are in stock: Blue Shirt only
    expect(result.map((r) => r.id)).toEqual(['1'])
  })

  it('returns empty array when no items match combined filters', () => {
    const result = filterSearchItems(items, {
      query: 'completely nonexistent xyzzy',
      categoryId: null,
      inStockOnly: false,
      categories: tree,
    })
    expect(result).toHaveLength(0)
  })

  it('inStockOnly + category: excludes out-of-stock even within matching category', () => {
    const result = filterSearchItems(items, {
      ...noFilter,
      categoryId: 'shirts',
      inStockOnly: true,
    })
    // shirts: Blue Shirt (inStock) + Out of Stock Shirt (not inStock) → only Blue Shirt
    expect(result.map((r) => r.id)).toEqual(['1'])
  })

  it('pre-built fuse opt produces identical results to on-demand index', () => {
    // When opts.fuse is provided, results must match what would be built on-demand.
    const fuse = buildSearchFuse(items)
    const withFuse = filterSearchItems(items, { ...noFilter, query: 'shirt', fuse })
    const withoutFuse = filterSearchItems(items, { ...noFilter, query: 'shirt' })
    expect(withFuse.map((r) => r.id).sort()).toEqual(withoutFuse.map((r) => r.id).sort())
  })

  it('pre-built fuse + category filter: post-filters fuse results to surviving items', () => {
    // fuse index covers all items; category filter must still narrow the results.
    const fuse = buildSearchFuse(items)
    const result = filterSearchItems(items, {
      query: 'shirt',
      categoryId: 'shirts',
      inStockOnly: false,
      categories: tree,
      fuse,
    })
    // Both shirts are in 'shirts' category; dresses/hats/pants are excluded by category
    const ids = result.map((r) => r.id).sort()
    expect(ids).toEqual(['1', '5'])
  })
})

// ─── buildSearchFuse ──────────────────────────────────────────────────────────

describe('buildSearchFuse', () => {
  it('builds a searchable Fuse index over ProductSearchItem[]', () => {
    const items = [
      mkSearchItem('a', 'Sneaker', { variantLabels: ['White'] }),
      mkSearchItem('b', 'Boot'),
    ]
    const fuse = buildSearchFuse(items)
    const results = fuse.search('sneaker')
    expect(results.map((r) => r.item.id)).toEqual(['a'])
  })
})
