'use client'

import * as React from 'react'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatPrice, getPriceRange } from '@/lib/utils/index'
import { en } from '@/lib/i18n/en'
import { ImageCarousel } from '@/components/store/product/ImageCarousel'
import { VariantSelector } from '@/components/store/product/VariantSelector'
import { SizePicker } from '@/components/store/product/SizePicker'
import { ProductActions } from '@/components/store/product/ProductActions'
import { NotifyMeDialog } from '@/components/store/product/NotifyMeDialog'
import type { ProductHeroProps } from '@/lib/types/store'

export function ProductHero({
  product,
  variants,
  sizesByVariant,
  imagesByVariant,
  isNew,
  isPopular,
  onAddToCart,
  onBuyNow,
  onWhatsApp,
  onCOD,
  isAddingToCart = false,
  className,
}: ProductHeroProps) {
  const [selectedVariantId, setSelectedVariantId] = React.useState<string>(
    variants[0]?.id ?? '',
  )
  const [selectedSizeId, setSelectedSizeId] = React.useState<string | null>(null)
  const [notifyOpen, setNotifyOpen] = React.useState(false)

  // Reset size selection when variant changes
  const handleVariantSelect = React.useCallback((id: string) => {
    setSelectedVariantId(id)
    setSelectedSizeId(null)
  }, [])

  const currentImages = imagesByVariant[selectedVariantId] ?? []
  const currentSizes = (sizesByVariant[selectedVariantId] ?? [])
    .filter((s) => s.active)
    .sort((a, b) => a.size.localeCompare(b.size))

  const selectedSize = currentSizes.find((s) => s.id === selectedSizeId) ?? null

  // All sizes OOS when every active size has stock === 0
  const allSizesOOS =
    currentSizes.length > 0 && currentSizes.every((s) => s.stock === 0)

  // Target for Notify Me: first OOS size of current variant, fallback to first size
  const notifyTarget =
    currentSizes.find((s) => s.stock === 0) ?? currentSizes[0] ?? null

  const currentVariant = variants.find((v) => v.id === selectedVariantId) ?? null

  // Price display: range across active sizes
  const { minPrice, maxPrice } = getPriceRange(currentSizes)
  const priceLabel =
    minPrice !== null
      ? minPrice === maxPrice
        ? formatPrice(minPrice)
        : `${formatPrice(minPrice)} – ${formatPrice(maxPrice!)}`
      : null

  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-12',
        className,
      )}
    >
      {/* Left: Image carousel */}
      <ImageCarousel images={currentImages} />

      {/* Right: Details */}
      <div className="flex flex-col gap-5">
        {/* Badges */}
        {(isNew || isPopular) && (
          <div className="flex gap-2">
            {isNew && <Badge>{en.product.new}</Badge>}
            {isPopular && (
              <Badge variant="secondary">{en.product.popularChoice}</Badge>
            )}
          </div>
        )}

        {/* Product name */}
        <h1 className="text-2xl font-bold leading-tight text-foreground md:text-3xl">
          {product.name}
        </h1>

        {/* Price */}
        {priceLabel && (
          <p className="text-xl font-semibold text-primary">{priceLabel}</p>
        )}
        {allSizesOOS && (
          <p className="text-sm font-medium text-muted-foreground">
            {en.store.outOfStock}
          </p>
        )}

        <Separator />

        {/* Description */}
        {product.description && (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {product.description}
          </p>
        )}

        {/* Variant selector — only show when >1 variant */}
        {variants.length > 1 && (
          <VariantSelector
            variants={variants}
            selectedVariantId={selectedVariantId}
            onSelect={handleVariantSelect}
          />
        )}

        {/* Size picker */}
        <SizePicker
          sizes={currentSizes}
          selectedSizeId={selectedSizeId}
          onSelect={setSelectedSizeId}
        />

        {/* Actions */}
        <ProductActions
          product={product}
          selectedVariant={currentVariant}
          selectedSize={selectedSize}
          allSizesOOS={allSizesOOS}
          isAddingToCart={isAddingToCart}
          onAddToCart={() => selectedSize && onAddToCart(selectedSize)}
          onBuyNow={() => selectedSize && onBuyNow(selectedSize)}
          onWhatsApp={() => selectedSize && onWhatsApp(selectedSize)}
          onCOD={() => selectedSize && onCOD(selectedSize)}
          onNotifyMe={() => setNotifyOpen(true)}
        />
      </div>

      {/* Notify Me dialog — owned here because we know which size is OOS */}
      {notifyTarget && currentVariant && (
        <NotifyMeDialog
          sizeOptionId={notifyTarget.id}
          productName={product.name}
          variantLabel={currentVariant.label}
          size={notifyTarget.size}
          open={notifyOpen}
          onOpenChange={setNotifyOpen}
        />
      )}
    </div>
  )
}
