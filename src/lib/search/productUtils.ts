// Pure JS helpers — NO fuse.js import. Safe to include in the initial bundle.
// Fuse-dependent code lives in productFuse.ts (lazy-loaded only).

import type { ProductWithVariants } from '@/lib/types/product'
import type { CategoryNode } from '@/lib/types/category'

/** All category ids in the subtree rooted at targetId (itself + descendants). */
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

/** Category-only filter (no fuzzy search). Used by useProductSearch on empty query. */
export function filterByCategory(
  items: ProductWithVariants[],
  descendantIds: Set<string> | null,
): ProductWithVariants[] {
  if (!descendantIds) return items
  return items.filter((item) => item.categoryIds.some((id) => descendantIds.has(id)))
}

/** Slice the first `page` pages out of `filtered`. `page` is 1-based. */
export function paginate<T>(
  filtered: T[],
  page: number,
  pageSize: number,
): { visibleItems: T[]; hasMore: boolean } {
  const visibleItems = filtered.slice(0, page * pageSize)
  return { visibleItems, hasMore: visibleItems.length < filtered.length }
}
