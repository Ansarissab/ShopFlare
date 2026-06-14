import Fuse, { type IFuseOptions } from 'fuse.js'
import type { ProductWithVariants } from '@/lib/types/product'
import type { CategoryNode } from '@/lib/types/category'
import type { ProductSearchItem } from '@/lib/types/search'

// Pure, DOM-free product search + pagination logic. Lives in lib (not the hook)
// so it can be unit-tested in the node pool and reused. `useProductSearch` is a
// thin React wrapper over these functions.

// Fuse config is defined once here and shared by the hook + tests, so search
// behaviour never drifts between them.
export const PRODUCT_FUSE_OPTIONS: IFuseOptions<ProductWithVariants> = {
  keys: ['product.name', 'product.description', 'variants.label'],
  threshold: 0.35,
  ignoreLocation: true,
}

export function buildProductFuse(items: ProductWithVariants[]): Fuse<ProductWithVariants> {
  return new Fuse(items, PRODUCT_FUSE_OPTIONS)
}

// All category ids in the subtree rooted at `targetId` (itself + descendants).
// A parent category therefore matches products tagged on any of its children.
export function collectDescendantIds(categories: CategoryNode[], targetId: string): Set<string> {
  const ids = new Set<string>()

  function addAll(node: CategoryNode) {
    ids.add(node.id)
    for (const child of node.children ?? []) addAll(child)
  }

  function walk(nodes: CategoryNode[]) {
    for (const node of nodes) {
      if (node.id === targetId) {
        addAll(node)
      } else {
        walk(node.children ?? [])
      }
    }
  }

  walk(categories)
  return ids
}

// Apply fuzzy query + category filter (AND). `fuse` is optional so callers that
// never search can skip building an index.
export function filterProducts(
  items: ProductWithVariants[],
  opts: {
    query: string
    descendantIds: Set<string> | null
    fuse?: Fuse<ProductWithVariants> | null
  },
): ProductWithVariants[] {
  let result = items

  const q = opts.query.trim()
  if (q) {
    const fuse = opts.fuse ?? buildProductFuse(items)
    result = fuse.search(q).map((r) => r.item)
  }

  if (opts.descendantIds) {
    const ids = opts.descendantIds
    result = result.filter((item) => item.categoryIds.some((id) => ids.has(id)))
  }

  return result
}

// ─── Search-index Fuse helpers (Phase 29a) ────────────────────────────────────
//
// Separate Fuse config for the lightweight ProductSearchItem rows returned by
// GET /api/products/search-index. Keys mirror the item shape, not the nested
// ProductWithVariants shape. Lives here so it's unit-testable in the node pool
// and not bundled until the overlay lazy-loads fuse.js.

export const SEARCH_INDEX_FUSE_OPTIONS: IFuseOptions<ProductSearchItem> = {
  keys: ['name', 'description', 'variantLabels'],
  threshold: 0.35,
  ignoreLocation: true,
}

/**
 * Build a Fuse index over a ProductSearchItem[]. Call once when the items
 * array changes (e.g. useMemo keyed on items) and pass the result into
 * filterSearchItems via opts.fuse to avoid rebuilding on every keystroke.
 */
export function buildSearchFuse(items: ProductSearchItem[]): Fuse<ProductSearchItem> {
  return new Fuse(items, SEARCH_INDEX_FUSE_OPTIONS)
}

export interface FilterSearchItemsOpts {
  query: string
  categoryId: string | null
  inStockOnly: boolean
  categories: CategoryNode[]
  /** Pre-built Fuse index keyed on the full items list. When provided the
   *  overlay avoids rebuilding the index on every keystroke. */
  fuse?: Fuse<ProductSearchItem> | null
}

/**
 * Client-side filter over ProductSearchItem[].
 * Applies fuzzy query (Fuse), category-descendant filter, and in-stock filter
 * all in one pass so the overlay can call a single function. Pure + testable.
 *
 * Pass a pre-built `fuse` (from buildSearchFuse) to avoid rebuilding the index
 * on every keystroke. When opts.fuse is omitted a temporary index is built on
 * the already-filtered result set (same behaviour as before, just slower).
 *
 * IMPORTANT: This function imports Fuse synchronously — the overlay must
 * dynamic-import this module (or the overlay component itself) to keep Fuse
 * out of the initial bundle.
 */
export function filterSearchItems(
  items: ProductSearchItem[],
  opts: FilterSearchItemsOpts,
): ProductSearchItem[] {
  let result = items

  // In-stock filter
  if (opts.inStockOnly) {
    result = result.filter((item) => item.inStock)
  }

  // Category filter — include self + all descendants
  if (opts.categoryId) {
    const ids = collectDescendantIds(opts.categories, opts.categoryId)
    result = result.filter((item) => item.categoryIds.some((id) => ids.has(id)))
  }

  // Fuzzy query filter — use the pre-built index when provided, but note: the
  // pre-built index covers the full items list, so we post-filter its results
  // to keep only items that survived the stock/category filters above.
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

// Slice the first `page` pages out of `filtered`. `page` is 1-based.
export function paginate<T>(
  filtered: T[],
  page: number,
  pageSize: number,
): { visibleItems: T[]; hasMore: boolean } {
  const visibleItems = filtered.slice(0, page * pageSize)
  return { visibleItems, hasMore: visibleItems.length < filtered.length }
}
