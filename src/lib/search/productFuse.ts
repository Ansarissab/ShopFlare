// Fuse-dependent search logic. This is the ONLY module that imports fuse.js.
// Never import this module statically from the initial bundle — only via
// dynamic import() (useProductSearch lazy path, GlobalSearchOverlay boundary).

import Fuse, { type IFuseOptions } from 'fuse.js'
import type { ProductWithVariants } from '@/lib/types/product'
import type { CategoryNode } from '@/lib/types/category'
import type { ProductSearchItem } from '@/lib/types/search'
import { collectDescendantIds } from './productUtils'

// ─── Product catalog Fuse ────────────────────────────────────────────────────

export const PRODUCT_FUSE_OPTIONS: IFuseOptions<ProductWithVariants> = {
  keys: ['product.name', 'product.description', 'variants.label'],
  threshold: 0.35,
  ignoreLocation: true,
}

export function buildProductFuse(items: ProductWithVariants[]): Fuse<ProductWithVariants> {
  return new Fuse(items, PRODUCT_FUSE_OPTIONS)
}

/**
 * Apply fuzzy query then optional category filter (AND).
 * Caller must pass a pre-built fuse; inline build is not supported here
 * since callers always hold an index (built once in useProductSearch).
 */
export function fuzzyFilterProducts(
  items: ProductWithVariants[],
  fuse: Fuse<ProductWithVariants>,
  query: string,
  descendantIds: Set<string> | null,
): ProductWithVariants[] {
  let result: ProductWithVariants[] = fuse.search(query.trim()).map((r) => r.item)
  if (descendantIds) {
    result = result.filter((item) => item.categoryIds.some((id) => descendantIds.has(id)))
  }
  return result
}

// ─── Search-index Fuse (GlobalSearchOverlay) ─────────────────────────────────

export const SEARCH_INDEX_FUSE_OPTIONS: IFuseOptions<ProductSearchItem> = {
  keys: ['name', 'description', 'variantLabels'],
  threshold: 0.35,
  ignoreLocation: true,
}

export function buildSearchFuse(items: ProductSearchItem[]): Fuse<ProductSearchItem> {
  return new Fuse(items, SEARCH_INDEX_FUSE_OPTIONS)
}

export interface FilterSearchItemsOpts {
  query: string
  categoryId: string | null
  inStockOnly: boolean
  categories: CategoryNode[]
  /** Pre-built Fuse index keyed on the full items list. */
  fuse?: Fuse<ProductSearchItem> | null
}

/**
 * Client-side filter over ProductSearchItem[].
 * Applies fuzzy query (Fuse), category-descendant filter, and in-stock filter.
 * Pass a pre-built `fuse` (from buildSearchFuse) to avoid rebuilding per keystroke.
 */
export function filterSearchItems(
  items: ProductSearchItem[],
  opts: FilterSearchItemsOpts,
): ProductSearchItem[] {
  let result = items

  if (opts.inStockOnly) {
    result = result.filter((item) => item.inStock)
  }

  if (opts.categoryId) {
    const ids = collectDescendantIds(opts.categories, opts.categoryId)
    result = result.filter((item) => item.categoryIds.some((id) => ids.has(id)))
  }

  const q = opts.query.trim()
  if (q) {
    if (opts.fuse) {
      const surviving = new Set(result.map((r) => r.id))
      result = opts.fuse
        .search(q)
        .map((r) => r.item)
        .filter((item) => surviving.has(item.id))
    } else {
      result = new Fuse(result, SEARCH_INDEX_FUSE_OPTIONS).search(q).map((r) => r.item)
    }
  }

  return result
}
