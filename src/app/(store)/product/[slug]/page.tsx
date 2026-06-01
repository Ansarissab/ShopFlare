'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { ProductHero } from '@/components/store/product/ProductHero'
import { useCart } from '@/hooks/useCart'
import type { Product, Variant, SizeOption, ProductImage } from 'worker/db/schema'

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? ''

type VariantWithDetails = Variant & {
  images: ProductImage[]
  sizes: SizeOption[]
}

type ProductWithVariants = {
  product: Product
  variants: VariantWithDetails[]
}

function buildMaps(variants: VariantWithDetails[]) {
  const sizesByVariant: Record<string, SizeOption[]> = {}
  const imagesByVariant: Record<string, ProductImage[]> = {}
  for (const v of variants) {
    sizesByVariant[v.id] = v.sizes
    imagesByVariant[v.id] = v.images
  }
  return { sizesByVariant, imagesByVariant }
}

function ProductDetailSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Image skeleton */}
        <div className="flex flex-col gap-3">
          <Skeleton className="aspect-square w-full rounded-xl" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-16 flex-none rounded-md" />
            ))}
          </div>
        </div>
        {/* Info skeleton */}
        <div className="flex flex-col gap-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-6 w-1/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <div className="flex gap-2 pt-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-10 rounded-full" />
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

function ProductDetailHero({ item }: { item: ProductWithVariants }) {
  const { addItem, openCart } = useCart()
  const [isAddingToCart, setIsAddingToCart] = useState(false)

  const { sizesByVariant, imagesByVariant } = buildMaps(item.variants)

  const handleAddToCart = useCallback(
    (size: SizeOption) => {
      setIsAddingToCart(true)
      const variant = item.variants.find((v) =>
        v.sizes.some((s: SizeOption) => s.id === size.id),
      )
      const firstImage = variant?.images[0]?.url ?? ''
      addItem({
        sizeOptionId: size.id,
        productId: item.product.id,
        variantId: variant?.id ?? '',
        productName: item.product.name,
        variantLabel: variant?.label ?? '',
        size: size.size,
        sku: size.sku ?? undefined,
        priceCents: size.priceCents,
        stripePriceId: size.stripePriceId ?? undefined,
        imageUrl: firstImage,
        quantity: 1,
      })
      openCart()
      setIsAddingToCart(false)
    },
    [item, addItem, openCart],
  )

  const handleBuyNow = useCallback(
    (size: SizeOption) => {
      handleAddToCart(size)
    },
    [handleAddToCart],
  )

  const handleWhatsApp = useCallback(() => {
    // WhatsApp order flow — handled in later phase
  }, [])

  const handleCOD = useCallback(() => {
    // COD flow — handled in later phase
  }, [])

  const handleNotifyMe = useCallback(() => {
    // Notify-me flow — handled in later phase
  }, [])

  return (
    <ProductHero
      product={item.product}
      variants={item.variants}
      sizesByVariant={sizesByVariant}
      imagesByVariant={imagesByVariant}
      isAddingToCart={isAddingToCart}
      onAddToCart={handleAddToCart}
      onBuyNow={handleBuyNow}
      onWhatsApp={handleWhatsApp}
      onCOD={handleCOD}
      onNotifyMe={handleNotifyMe}
    />
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
        if (res.status === 404) {
          setNotFound(true)
          return
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as ProductWithVariants
        setItem(data)
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
      <div className="mx-auto flex min-h-[60vh] max-w-7xl flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Product Not Found</h1>
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
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <ProductDetailHero item={item} />
    </div>
  )
}
