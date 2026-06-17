'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { ProductHeroWrapper } from '@/components/store/product/ProductHeroWrapper'
import { ProductGrid } from '@/components/store/product/ProductGrid'
import { CategoryFilter } from '@/components/store/categories/CategoryFilter'
import { InfiniteScrollSentinel } from '@/components/shared/InfiniteScrollSentinel'
import { layout } from '@/lib/styles'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/Provider'
import { DEFAULT_PRODUCT_PAGE_SIZE } from '@/lib/constants'
import type { ProductWithVariants } from '@/lib/types/product'
import type { CategoryNode } from '@/lib/types/category'
import { useApiResource } from '@/hooks/useApiResource'
import { useStoreConfig } from '@/hooks/useStoreConfig'
import { useProductSearch } from '@/hooks/useProductSearch'

interface CatalogProps {
  /** Base path for URL sync — '/' when landing is OFF, '/shop' when ON. */
  basePath?: string
  /**
   * SSR-seeded product list from the RSC page. When provided the catalog renders
   * the real grid on first paint (no skeleton) and still revalidates via the hook.
   */
  initialProducts?: ProductWithVariants[]
  /**
   * SSR-seeded category list from the RSC page. Prevents a server/client hydration
   * mismatch: without it the server renders with no categories (the hook can't
   * fire effects during SSR) while the client may see cached category data on its
   * first render, producing a different DOM structure.
   */
  initialCategories?: CategoryNode[]
}

function ProductListingSkeleton() {
  return (
    <div className={layout.page}>
      <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2.5">
            <Skeleton className="aspect-4/5 w-full rounded-[3px]" />
            <Skeleton className="h-4 w-3/4" />
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

export function Catalog({ basePath = '/', initialProducts, initialCategories }: CatalogProps) {
  const t = useT()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { config } = useStoreConfig()

  const fallback = initialProducts ? { products: initialProducts } : undefined
  const catFallback = initialCategories ? { categories: initialCategories } : undefined

  const { data, loading, error } = useApiResource<{ products: ProductWithVariants[] }>(
    '/api/products',
    {
      refetchInterval: 60_000,
      refetchOnFocus: true,
      refetchOnChannel: true,
      fallbackData: fallback,
    },
  )
  const { data: catData } = useApiResource<{ categories: CategoryNode[] }>('/api/categories', {
    fallbackData: catFallback,
  })

  const [activeCategory, setActiveCategory] = useState<string | null>(
    () => searchParams?.get('category') ?? null,
  )
  const [query, setQuery] = useState(() => searchParams?.get('q') ?? '')

  // URL → state: when GlobalSearchOverlay (or a direct URL) sets ?q=, pull it
  // into local state so the product grid re-filters.
  useEffect(() => {
    const urlQ = searchParams?.get('q') ?? ''
    if (urlQ !== query) setQuery(urlQ)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // State → URL: keep the URL in sync when category filter changes (query URL
  // is owned by GlobalSearchOverlay; category has no other URL writer).
  useEffect(() => {
    const currentCat = searchParams?.get('category') ?? null
    if (currentCat === activeCategory) return
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    if (activeCategory) {
      params.set('category', activeCategory)
    } else {
      params.delete('category')
    }
    const paramStr = params.toString()
    router.replace(paramStr ? `${basePath}?${paramStr}` : basePath, { scroll: false })
  }, [activeCategory, router, searchParams, basePath])

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
      <div className={cn(layout.centeredState, 'max-w-7xl py-24')}>
        <h1 className="text-[clamp(2rem,5vw,3rem)] tracking-tight">{t.store.comingSoon}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.store.comingSoonBody}</p>
        <p className="text-sm text-muted-foreground">{t.store.comingSoonSubtext}</p>
      </div>
    )
  }

  if (items.length === 1 && !query && activeCategory === null) {
    return (
      <div className={layout.page}>
        <ProductHeroWrapper item={items[0]} />
      </div>
    )
  }

  return (
    <div className={layout.page}>
      <h1 className="sr-only">{t.store.allProducts}</h1>

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
          <div className={cn(layout.centeredState, 'min-h-[40vh] py-16')}>
            <h2 className="tracking-tight text-2xl">{t.store.searchNoResultsHeading}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t.store.searchNoResults} &quot;{query}&quot;
            </p>
            <button
              type="button"
              onClick={() => {
                const params = new URLSearchParams(searchParams?.toString() ?? '')
                params.delete('q')
                const paramStr = params.toString()
                router.replace(paramStr ? `${basePath}?${paramStr}` : basePath, { scroll: false })
              }}
              className="mt-3 text-sm text-primary underline-offset-4 hover:underline"
            >
              {t.store.searchClearHint}
            </button>
          </div>
        ) : (
          <div className={cn(layout.centeredState, 'min-h-[40vh] py-16')}>
            <h2 className="tracking-tight text-2xl">{t.store.categoryEmptyHeading}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t.store.categoryEmptySubtext}</p>
          </div>
        )
      ) : (
        <>
          <p className="mb-6 font-mono text-xs uppercase tracking-wide text-muted-foreground">
            {hasMore
              ? t.store.showingProductsOf
                  .replace('{shown}', String(visibleItems.length))
                  .replace('{total}', String(totalFiltered))
              : t.store.showingProducts.replace('{count}', String(totalFiltered))}
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
