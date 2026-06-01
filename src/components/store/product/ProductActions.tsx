'use client'

import { Loader2, ShoppingCart, Zap, MessageCircle, Banknote, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { en } from '@/lib/i18n/en'
import { cn } from '@/lib/utils'
import type { Product, Variant, SizeOption } from 'worker/db/schema'

interface ProductActionsProps {
  product: Product
  selectedVariant: Variant | null
  selectedSize: SizeOption | null
  allSizesOOS: boolean
  isAddingToCart: boolean
  onAddToCart: () => void
  onBuyNow: () => void
  onWhatsApp: () => void
  onCOD: () => void
  onNotifyMe: () => void
  className?: string
}

export function ProductActions({
  selectedSize,
  allSizesOOS,
  isAddingToCart,
  onAddToCart,
  onBuyNow,
  onWhatsApp,
  onCOD,
  onNotifyMe,
  className,
}: ProductActionsProps) {
  const hasSelection = selectedSize !== null

  if (allSizesOOS) {
    return (
      <div className={cn('flex flex-col gap-3', className)}>
        <Button
          variant="outline"
          size="lg"
          className="w-full gap-2"
          onClick={onNotifyMe}
        >
          <Bell className="size-4" />
          {en.store.notifyMe}
        </Button>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Primary: Add to Cart */}
      <Button
        size="lg"
        className="w-full gap-2"
        disabled={!hasSelection || isAddingToCart}
        onClick={onAddToCart}
      >
        {isAddingToCart ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <ShoppingCart className="size-4" />
        )}
        {en.store.addToCart}
      </Button>

      {/* Secondary: Buy Now (Stripe Checkout) */}
      <Button
        variant="secondary"
        size="lg"
        className="w-full gap-2"
        disabled={!hasSelection}
        onClick={onBuyNow}
      >
        <Zap className="size-4" />
        {en.store.buyNow}
      </Button>

      {/* Contextual: WhatsApp + COD — only when size is selected */}
      {hasSelection && (
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="lg"
            className="gap-2"
            onClick={onWhatsApp}
          >
            <MessageCircle className="size-4" />
            <span className="truncate">{en.store.orderOnWhatsApp}</span>
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="gap-2"
            onClick={onCOD}
          >
            <Banknote className="size-4" />
            <span className="truncate">{en.store.cashOnDelivery}</span>
          </Button>
        </div>
      )}
    </div>
  )
}
