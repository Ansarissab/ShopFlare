'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { ProductHeroWrapper } from '@/components/store/product/ProductHeroWrapper'
import { ReviewsSection } from '@/components/store/product/ReviewsSection'
import { ProductJsonLd } from '@/components/store/product/ProductJsonLd'
import { layout } from '@/lib/styles'
import { cn } from '@/lib/utils'
import type { ProductWithVariants } from '@/lib/types/store'
import { en } from '@/lib/i18n/en'
import { useApiResource } from '@/hooks/useApiResource'

function ProductDetailSkeleton() {
  return (
    <div className={layout.page}>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <Skeleton className="aspect-square w-full rounded-xl" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-16 flex-none rounded-md" />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-6 w-1/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <div className="flex gap-2 pt-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="size-10 rounded-full" />
            ))}
          </div>
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-16 rounded-md" />
            ))}
          </div>
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      </div>
    </div>
  )
}

export default function ProductDetailPage() {
  const params = useParams<{ slug: string }>()
  const { data: item, loading, notFound } = useApiResource<ProductWithVariants>(
    params?.slug ? `/api/products/${params.slug}` : null,
  )

  if (loading) return <ProductDetailSkeleton />

  if (notFound || !item) {
    return (
      <div className={cn(layout.centeredState, 'max-w-7xl')}>
        <h1>{en.product.notFound}</h1>
        <p className="text-muted-foreground text-sm">
          {en.product.notFoundBody}
        </p>
        <Link href="/" className="text-sm text-primary underline-offset-4 hover:underline">
          {en.product.backToStore}
        </Link>
      </div>
    )
  }

  return (
    <div className={layout.page}>
      <ProductJsonLd item={item} />
      <ProductHeroWrapper item={item} />
      <ReviewsSection
        productId={item.product.id}
        productName={item.product.name}
        className="mt-10"
      />
    </div>
  )
}
