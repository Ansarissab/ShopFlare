'use client'

import { useEffect, useState, useCallback } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { ProductHero } from '@/components/store/product/ProductHero'
import { ProductCard } from '@/components/store/product/ProductCard'
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

function allSizes(variants: VariantWithDetails[]): SizeOption[] {
  return variants.flatMap((v) => v.sizes)
}

function allImages(variants: VariantWithDetails[]): ProductImage[] {
  return variants.flatMap((v) => v.images)
}

function ProductListingSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
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

function SingleProductHero({ item }: { item: ProductWithVariants }) {
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

export default function StorePage() {
  const [items, setItems] = useState<ProductWithVariants[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchProducts() {
      try {
        const res = await fetch(`${WORKER_URL}/api/products`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as { products: ProductWithVariants[] }
        setItems(data.products ?? [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load products')
      } finally {
        setLoading(false)
      }
    }
    fetchProducts()
  }, [])

  if (loading) return <ProductListingSkeleton />

  if (error) {
    return (
      <div className="mx-auto flex min-h-[40vh] max-w-7xl items-center justify-center px-4">
        <p className="text-muted-foreground text-sm">{error}</p>
      </div>
    )
  }

  // Zero products — coming soon
  if (items.length === 0) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-7xl flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Coming Soon</h1>
        <p className="text-muted-foreground">Check back soon for new products.</p>
      </div>
    )
  }

  // Single product — hero layout
  if (items.length === 1) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <SingleProductHero item={items[0]} />
      </div>
    )
  }

  // Multi-product grid
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <ProductCard
            key={item.product.id}
            product={item.product}
            variants={item.variants}
            sizes={allSizes(item.variants)}
            images={allImages(item.variants)}
          />
        ))}
      </div>
    </div>
  )
}
