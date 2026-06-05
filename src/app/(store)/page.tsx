'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { ProductHeroWrapper } from '@/components/store/product/ProductHeroWrapper'
import { ProductGrid } from '@/components/store/product/ProductGrid'
import { CategoryFilter } from '@/components/store/categories/CategoryFilter'
import { SearchBar } from '@/components/store/search/SearchBar'
import { InfiniteScrollSentinel } from '@/components/shared/InfiniteScrollSentinel'
import { layout } from '@/lib/styles'
import { cn } from '@/lib/utils'
import { en } from '@/lib/i18n/en'
import { DEFAULT_PRODUCT_PAGE_SIZE } from '@/lib/constants'
import type { ProductWithVariants } from '@/lib/types/product'
import type { CategoryNode } from '@/lib/types/category'
import { useApiResource } from '@/hooks/useApiResource'
import { useStoreConfig } from '@/hooks/useStoreConfig'
import { useProductSearch } from '@/hooks/useProductSearch'

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

function findCategoryBySlug(categories: CategoryNode[], slug: string): CategoryNode | null {
  for (const cat of categories) {
    if (cat.slug === slug) return cat
    const found = findCategoryBySlug(cat.children ?? [], slug)
    if (found) return found
  }
  return null
}

export default function StorePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { config } = useStoreConfig()

  const { data, loading, error } = useApiResource<{ products: ProductWithVariants[] }>(
    '/api/products',
    { refetchInterval: 60_000, refetchOnFocus: true, refetchOnChannel: true },
  )
  const { data: catData } = useApiResource<{ categories: CategoryNode[] }>('/api/categories')

  const [activeCategory, setActiveCategory] = useState<string | null>(
    () => searchParams?.get('category') ?? null,
  )
  const [query, setQuery] = useState(() => searchParams?.get('q') ?? '')

  // Sync URL when search or category filter changes
  useEffect(() => {
    const currentQ = searchParams?.get('q') ?? ''
    const currentCat = searchParams?.get('category') ?? null
    if (currentQ === query && currentCat === activeCategory) return
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (activeCategory) params.set('category', activeCategory)
    const paramStr = params.toString()
    router.replace(paramStr ? `/?${paramStr}` : '/', { scroll: false })
  }, [query, activeCategory, router, searchParams])

  const items = data?.products ?? []
  const allCategories = catData?.categories ?? []
  const topLevel = allCategories.filter((c) => !c.parentId)

  const activeCategoryId = activeCategory
    ? (findCategoryBySlug(allCategories, activeCategory)?.id ?? null)
    : null

  const pageSize = config?.productPageSize ?? DEFAULT_PRODUCT_PAGE_SIZE

  const { visibleItems, hasMore, loadMore, isLoadingMore, totalFiltered } = useProductSearch({
    items,
    pageSize,
    query,
    activeCategoryId,
    allCategories,
  })

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

  // Single-product hero only when completely unfiltered
  if (items.length === 1 && !query && activeCategory === null) {
    return (
      <div className={layout.page}>
        <ProductHeroWrapper item={items[0]} />
      </div>
    )
  }

  return (
    <div className={layout.page}>
      <div className="mb-4">
        <SearchBar value={query} onChange={setQuery} />
      </div>

      {topLevel.length > 0 && (
        <div className="mb-6">
          <CategoryFilter
            categories={topLevel}
            activeSlug={activeCategory}
            onChange={setActiveCategory}
          />
        </div>
      )}

      {visibleItems.length === 0 ? (
        query ? (
          <div className={cn(layout.centeredState, 'min-h-[30vh]')}>
            <p className="text-muted-foreground">
              {en.store.searchNoResults} &quot;{query}&quot;
            </p>
            <button
              type="button"
              onClick={() => setQuery('')}
              className="mt-2 text-sm text-primary underline-offset-4 hover:underline"
            >
              {en.store.searchClearHint}
            </button>
          </div>
        ) : (
          <div className={cn(layout.centeredState, 'min-h-[30vh]')}>
            <p className="text-muted-foreground">{en.store.categoryEmpty}</p>
          </div>
        )
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            {hasMore
              ? en.store.showingProductsOf
                  .replace('{shown}', String(visibleItems.length))
                  .replace('{total}', String(totalFiltered))
              : en.store.showingProducts.replace('{count}', String(totalFiltered))}
          </p>
          <ProductGrid items={visibleItems} />
          <InfiniteScrollSentinel
            onVisible={loadMore}
            isLoading={isLoadingMore}
            hasMore={hasMore}
            totalItems={totalFiltered}
            pageSize={pageSize}
          />
        </>
      )}
    </div>
  )
}
