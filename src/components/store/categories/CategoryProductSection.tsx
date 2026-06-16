'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ProductGrid } from '@/components/store/product/ProductGrid'
import { InfiniteScrollSentinel } from '@/components/shared/InfiniteScrollSentinel'
import { layout } from '@/lib/styles'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/Provider'
import { useProductSearch } from '@/hooks/useProductSearch'
import type { ProductWithVariants } from '@/lib/types/product'

interface CategoryProductSectionProps {
  slug: string
  products: ProductWithVariants[]
  pageSize: number
  flatRateCents: number
  thresholdCents: number
  initialQuery?: string
}

export function CategoryProductSection({
  slug,
  products,
  pageSize,
  flatRateCents,
  thresholdCents,
  initialQuery = '',
}: CategoryProductSectionProps) {
  const t = useT()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(() => searchParams?.get('q') ?? initialQuery)

  // URL → state: GlobalSearchOverlay sets ?q= on the URL; pull it into local
  // state so the product grid re-filters.
  useEffect(() => {
    const urlQ = searchParams?.get('q') ?? ''
    if (urlQ !== query) setQuery(urlQ)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const { visibleItems, hasMore, loadMore, isLoadingMore, totalFiltered } = useProductSearch({
    items: products,
    pageSize,
    query,
    activeCategoryId: null,
    allCategories: [],
  })

  if (visibleItems.length === 0) {
    return query ? (
      <div className={cn(layout.centeredState, 'min-h-[30vh]')}>
        <p className="text-muted-foreground mt-4">
          {t.store.searchNoResults} &quot;{query}&quot;
        </p>
        <button
          type="button"
          onClick={() => router.replace(`/category/${slug}`, { scroll: false })}
          className="mt-2 text-sm text-primary underline-offset-4 hover:underline"
        >
          {t.store.searchClearHint}
        </button>
      </div>
    ) : (
      <div className={cn(layout.centeredState, 'min-h-[30vh]')}>
        <p className="text-muted-foreground">{t.store.categoryEmpty}</p>
      </div>
    )
  }

  return (
    <>
      <ProductGrid items={visibleItems} storeConfig={{ flatRateCents, thresholdCents }} />
      <InfiniteScrollSentinel
        onVisible={loadMore}
        isLoading={isLoadingMore}
        hasMore={hasMore}
        totalItems={totalFiltered}
        pageSize={pageSize}
      />
    </>
  )
}
