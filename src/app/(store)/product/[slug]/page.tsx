'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { ProductHeroWrapper } from '@/components/store/product/ProductHeroWrapper'
import { layout } from '@/lib/styles'
import { cn } from '@/lib/utils'
import type { ProductWithVariants } from '@/lib/types/store'

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? ''

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
  const [item, setItem] = useState<ProductWithVariants | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!params?.slug) return
    async function fetchProduct() {
      try {
        const res = await fetch(`${WORKER_URL}/api/products/${params.slug}`)
        if (res.status === 404) { setNotFound(true); return }
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        setItem((await res.json()) as ProductWithVariants)
      } catch {
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    fetchProduct()
  }, [params?.slug])

  if (loading) return <ProductDetailSkeleton />

  if (notFound || !item) {
    return (
      <div className={cn(layout.centeredState, 'max-w-7xl')}>
        <h1>Product Not Found</h1>
        <p className="text-muted-foreground text-sm">
          This product does not exist or may have been removed.
        </p>
        <a href="/" className="text-sm text-primary underline-offset-4 hover:underline">
          Back to store
        </a>
      </div>
    )
  }

  return (
    <div className={layout.page}>
      <ProductHeroWrapper item={item} />
    </div>
  )
}
