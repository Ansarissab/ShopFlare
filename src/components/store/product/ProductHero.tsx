'use client'

import * as React from 'react'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatPrice, getPriceRange } from '@/lib/utils/index'
import { useT } from '@/lib/i18n/Provider'
import { ImageCarousel } from '@/components/store/product/ImageCarousel'
import { VariantSelector } from '@/components/store/product/VariantSelector'
import { SizePicker } from '@/components/store/product/SizePicker'
import { ProductActions } from '@/components/store/product/ProductActions'
import dynamic from 'next/dynamic'

const NotifyMeDialog = dynamic(() => import('./NotifyMeDialog').then((m) => m.NotifyMeDialog), {
  ssr: false,
})
import type { ProductHeroProps } from '@/lib/types/product'

export function ProductHero({
  product,
  variants,
  sizesByVariant,
  imagesByVariant,
  currency,
  isNew,
  isPopular,
  showWhatsApp,
  onAddToCart,
  onBuyNow,
  onWhatsApp,
  onCOD,
  isAddingToCart = false,
  isAdded = false,
  className,
}: ProductHeroProps) {
  const t = useT()
  const [selectedVariantId, setSelectedVariantId] = React.useState<string>(variants[0]?.id ?? '')
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
  const allSizesOOS = currentSizes.length > 0 && currentSizes.every((s) => s.stock === 0)

  // Target for Notify Me: first OOS size of current variant, fallback to first size
  const notifyTarget = currentSizes.find((s) => s.stock === 0) ?? currentSizes[0] ?? null

  const currentVariant = variants.find((v) => v.id === selectedVariantId) ?? null

  // Price display: range across active sizes
  const { minPrice, maxPrice } = getPriceRange(currentSizes)
  const priceLabel =
    minPrice !== null
      ? minPrice === maxPrice
        ? formatPrice(minPrice, currency)
        : `${formatPrice(minPrice, currency)} – ${formatPrice(maxPrice!, currency)}`
      : null

  return (
    <div
      className={cn('grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-16 md:items-start', className)}
    >
      {/* Left: Image gallery — full-width, color in view */}
      <ImageCarousel images={currentImages} />

      {/* Right: sticky purchase panel — commerce stack, always reachable */}
      <div className="md:sticky md:top-24 flex flex-col gap-5">
        {/* Badges */}
        {(isNew || isPopular) && (
          <div className="flex gap-2">
            {isNew && <Badge>{t.product.new}</Badge>}
            {isPopular && <Badge variant="secondary">{t.product.popularChoice}</Badge>}
          </div>
        )}

        {/* Product name — display serif (h1 base styles apply var(--font-display)), large */}
        <h1 className="text-3xl leading-tight text-foreground tracking-tight md:text-4xl">
          {product.name}
        </h1>

        {/* Price — Geist Mono, prominent */}
        {priceLabel && (
          <p className="font-mono text-2xl font-medium text-foreground tabular-nums">
            {priceLabel}
          </p>
        )}
        {allSizesOOS && (
          <p className="text-sm font-medium text-muted-foreground">{t.store.outOfStock}</p>
        )}

        <Separator />

        {/* Description — editorial, generous leading, muted */}
        {product.description && (
          <p className="text-base leading-relaxed text-muted-foreground">{product.description}</p>
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

        {/* Actions — tight commerce stack */}
        <ProductActions
          product={product}
          selectedVariant={currentVariant}
          selectedSize={selectedSize}
          allSizesOOS={allSizesOOS}
          isAddingToCart={isAddingToCart}
          isAdded={isAdded}
          showWhatsApp={showWhatsApp}
          onAddToCart={() => selectedSize && onAddToCart(selectedSize)}
          onBuyNow={() => selectedSize && onBuyNow(selectedSize)}
          onWhatsApp={() => selectedSize && onWhatsApp(selectedSize)}
          onCOD={() => selectedSize && onCOD(selectedSize)}
          onNotifyMe={() => setNotifyOpen(true)}
        />
      </div>

      {/* Notify Me dialog — deferred chunk; only mounted after first open */}
      {notifyOpen && notifyTarget && currentVariant && (
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
