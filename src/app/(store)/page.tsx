'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { ProductHeroWrapper } from '@/components/store/product/ProductHeroWrapper'
import { ProductCard } from '@/components/store/product/ProductCard'
import { layout } from '@/lib/styles'
import { cn } from '@/lib/utils'
import { en } from '@/lib/i18n/en'
import type { ProductWithVariants } from '@/lib/types/store'
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

export default function StorePage() {
  const { data, loading, error } = useApiResource<{ products: ProductWithVariants[] }>('/api/products')
  const items = data?.products ?? []

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

  if (items.length === 1) {
    return (
      <div className={layout.page}>
        <ProductHeroWrapper item={items[0]} />
      </div>
    )
  }

  return (
    <div className={layout.page}>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <ProductCard
            key={item.product.id}
            product={item.product}
            variants={item.variants}
            sizes={item.variants.flatMap((v) => v.sizes)}
            images={item.variants.flatMap((v) => v.images)}
          />
        ))}
      </div>
    </div>
  )
}
