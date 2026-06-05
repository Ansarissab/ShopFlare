'use client'

import { useMemo, useState, useEffect } from 'react'
import Fuse from 'fuse.js'
import type { ProductWithVariants } from '@/lib/types/product'
import type { CategoryNode } from '@/lib/types/category'

export interface UseProductSearchOpts {
  items: ProductWithVariants[]
  pageSize: number
  query: string
  activeCategoryId: string | null
  allCategories: CategoryNode[]
}

export interface UseProductSearchResult {
  visibleItems: ProductWithVariants[]
  hasMore: boolean
  loadMore: () => void
  isLoadingMore: boolean
  totalFiltered: number
}

function collectDescendantIds(categories: CategoryNode[], targetId: string): Set<string> {
  const ids = new Set<string>()

  function walk(nodes: CategoryNode[]) {
    for (const node of nodes) {
      if (node.id === targetId) {
        ids.add(node.id)
        addAll(node)
      } else {
        walk(node.children ?? [])
      }
    }
  }

  function addAll(node: CategoryNode) {
    ids.add(node.id)
    for (const child of node.children ?? []) addAll(child)
  }

  walk(categories)
  return ids
}

export function useProductSearch({
  items,
  pageSize,
  query,
  activeCategoryId,
  allCategories,
}: UseProductSearchOpts): UseProductSearchResult {
  const [page, setPage] = useState(1)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const fuseInstance = useMemo(
    () =>
      new Fuse(items, {
        keys: ['product.name', 'product.description', 'variants.label'],
        threshold: 0.35,
        ignoreLocation: true,
      }),
    [items],
  )

  const descendantIds = useMemo(() => {
    if (!activeCategoryId) return null
    return collectDescendantIds(allCategories, activeCategoryId)
  }, [activeCategoryId, allCategories])

  const filtered = useMemo(() => {
    let result = items

    if (query.trim()) {
      result = fuseInstance.search(query.trim()).map((r) => r.item)
    }

    if (descendantIds) {
      result = result.filter((item) =>
        item.categoryIds.some((id) => descendantIds.has(id)),
      )
    }

    return result
  }, [items, query, fuseInstance, descendantIds])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [query, activeCategoryId])

  const visibleItems = filtered.slice(0, page * pageSize)
  const hasMore = visibleItems.length < filtered.length

  function loadMore() {
    if (isLoadingMore || !hasMore) return
    setIsLoadingMore(true)
    setPage((p) => p + 1)
    setIsLoadingMore(false)
  }

  return {
    visibleItems,
    hasMore,
    loadMore,
    isLoadingMore,
    totalFiltered: filtered.length,
  }
}
