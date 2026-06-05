import Fuse, { type IFuseOptions } from 'fuse.js'
import type { ProductWithVariants } from '@/lib/types/product'
import type { CategoryNode } from '@/lib/types/category'

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
export function collectDescendantIds(
  categories: CategoryNode[],
  targetId: string,
): Set<string> {
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

// Slice the first `page` pages out of `filtered`. `page` is 1-based.
export function paginate<T>(
  filtered: T[],
  page: number,
  pageSize: number,
): { visibleItems: T[]; hasMore: boolean } {
  const visibleItems = filtered.slice(0, page * pageSize)
  return { visibleItems, hasMore: visibleItems.length < filtered.length }
}
