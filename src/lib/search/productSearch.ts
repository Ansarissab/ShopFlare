// Re-export barrel — for test backward-compatibility only.
// Production browser code must NOT import this file (it statically re-exports
// from productFuse which pulls fuse.js into the bundle).
//
// Browser code: import pure helpers from productUtils, lazy-import productFuse.
// Tests: import from this barrel (unchanged import paths, test-only).

export { collectDescendantIds, filterByCategory, paginate } from './productUtils'

export {
  PRODUCT_FUSE_OPTIONS,
  SEARCH_INDEX_FUSE_OPTIONS,
  buildProductFuse,
  buildSearchFuse,
  filterSearchItems,
  type FilterSearchItemsOpts,
} from './productFuse'

// filterProducts: legacy API kept for productSearch.test.ts.
// Combines pure category filter + Fuse fuzzy search.
// Do NOT call from browser-bundle code — use filterByCategory + lazy productFuse.
import Fuse from 'fuse.js'
import type { ProductWithVariants } from '@/lib/types/product'
import { buildProductFuse } from './productFuse'
import { filterByCategory } from './productUtils'

export function filterProducts(
  items: ProductWithVariants[],
  opts: {
    query: string
    descendantIds: Set<string> | null
    fuse?: Fuse<ProductWithVariants> | null
  },
): ProductWithVariants[] {
  const q = opts.query.trim()
  let result = items

  if (q) {
    const fuse = opts.fuse ?? buildProductFuse(items)
    result = fuse.search(q).map((r) => r.item)
  }

  return filterByCategory(result, opts.descendantIds)
}
