'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { ProductHeroWrapper } from '@/components/store/product/ProductHeroWrapper'
import { ProductGrid } from '@/components/store/product/ProductGrid'
import { CategoryFilter } from '@/components/store/categories/CategoryFilter'
import { layout } from '@/lib/styles'
import { cn } from '@/lib/utils'
import { en } from '@/lib/i18n/en'
import type { ProductWithVariants } from '@/lib/types/product'
import type { CategoryNode } from '@/lib/types/category'
import { useApiResource } from '@/hooks/useApiResource'

function ProductListingSkeleton() {
  return (
    <div className={layout.page}>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3">
            <Skeleton className="aspect-square w-full rounded-xl" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Collect all ids in a subtree rooted at any node whose slug matches. */
function collectChildIds(categories: CategoryNode[], slug: string): Set<string> {
  const ids = new Set<string>()

  function walk(nodes: CategoryNode[]) {
    for (const node of nodes) {
      if (node.slug === slug) {
        ids.add(node.id)
        for (const child of node.children ?? []) {
          addAll(child)
        }
      } else {
        walk(node.children ?? [])
      }
    }
  }

  function addAll(node: CategoryNode) {
    ids.add(node.id)
    for (const child of node.children ?? []) {
      addAll(child)
    }
  }

  walk(categories)
  return ids
}

export default function StorePage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const { data, loading, error } = useApiResource<{ products: ProductWithVariants[] }>('/api/products')
  const { data: catData } = useApiResource<{ categories: CategoryNode[] }>('/api/categories')

  // Initialise from URL on first render
  const [activeCategory, setActiveCategory] = useState<string | null>(
    () => searchParams?.get('category') ?? null,
  )

  // Sync URL when filter changes
  useEffect(() => {
    const current = searchParams?.get('category') ?? null
    if (current === activeCategory) return
    const url = activeCategory ? `/?category=${encodeURIComponent(activeCategory)}` : '/'
    router.replace(url, { scroll: false })
  }, [activeCategory, router, searchParams])

  const items = data?.products ?? []
  const allCategories = catData?.categories ?? []
  // Only top-level categories (no parentId) for the filter chips
  const topLevel = allCategories.filter((c) => !c.parentId)

  // Filtered items
  const filteredItems =
    activeCategory === null
      ? items
      : (() => {
          const ids = collectChildIds(allCategories, activeCategory)
          return items.filter((item) =>
            item.categoryIds.some((id) => ids.has(id)),
          )
        })()

  if (loading) return <ProductListingSkeleton />

  if (error) {
    return (
      <div className={cn(layout.inlineError, 'max-w-7xl')}>
        <p className="text-muted-foreground text-sm">{error}</p>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className={cn(layout.centeredState, 'max-w-7xl')}>
        <h1>{en.store.comingSoon}</h1>
        <p className="text-muted-foreground">{en.store.comingSoonBody}</p>
      </div>
    )
  }

  // Single-product hero only when viewing unfiltered
  if (items.length === 1 && activeCategory === null) {
    return (
      <div className={layout.page}>
        <ProductHeroWrapper item={items[0]} />
      </div>
    )
  }

  return (
    <div className={layout.page}>
      {topLevel.length > 0 && (
        <div className="mb-6">
          <CategoryFilter
            categories={topLevel}
            activeSlug={activeCategory}
            onChange={setActiveCategory}
          />
        </div>
      )}

      {filteredItems.length === 0 ? (
        <div className={cn(layout.centeredState, 'min-h-[30vh]')}>
          <p className="text-muted-foreground">{en.store.categoryEmpty}</p>
        </div>
      ) : (
        <ProductGrid items={filteredItems} />
      )}
    </div>
  )
}
