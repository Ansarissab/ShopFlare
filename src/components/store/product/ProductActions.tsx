'use client'

import { Check, Loader2, ShoppingCart, Zap, MessageCircle, Banknote, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n/Provider'
import { cn } from '@/lib/utils'
import type { ProductActionsProps } from '@/lib/types/product'

export function ProductActions({
  selectedSize,
  allSizesOOS,
  isAddingToCart,
  isAdded = false,
  showWhatsApp,
  onAddToCart,
  onBuyNow,
  onWhatsApp,
  onCOD,
  onNotifyMe,
  className,
}: ProductActionsProps) {
  const t = useT()
  const hasSelection = selectedSize !== null

  if (allSizesOOS) {
    return (
      <div className={cn('flex flex-col gap-3', className)}>
        <Button variant="outline" size="lg" className="w-full gap-2 min-h-11" onClick={onNotifyMe}>
          <Bell className="size-4" />
          {t.store.notifyMe}
        </Button>
      </div>
    )
  }

  // idle → adding (spinner) → added (check) → idle
  function cartIcon() {
    if (isAddingToCart) return <Loader2 className="size-4 animate-spin" />
    if (isAdded) return <Check className="size-4" />
    return <ShoppingCart className="size-4" />
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Primary: Add to Cart */}
      <Button
        size="lg"
        className="w-full gap-2 min-h-11"
        disabled={!hasSelection || isAddingToCart || isAdded}
        onClick={onAddToCart}
      >
        {cartIcon()}
        {isAdded ? t.store.addedToCart : t.store.addToCart}
      </Button>

      {/* Secondary: Buy Now (Stripe Checkout) */}
      <Button
        variant="secondary"
        size="lg"
        className="w-full gap-2 min-h-11"
        disabled={!hasSelection}
        onClick={onBuyNow}
      >
        <Zap className="size-4" />
        {t.store.buyNow}
      </Button>

      {/* Contextual: WhatsApp + COD — only when size is selected */}
      {hasSelection && (
        <div
          className={cn('grid gap-2', showWhatsApp ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1')}
        >
          {showWhatsApp && (
            <Button variant="outline" size="lg" className="gap-2 min-h-11" onClick={onWhatsApp}>
              <MessageCircle className="size-4" />
              <span className="truncate">{t.store.orderOnWhatsApp}</span>
            </Button>
          )}
          <Button variant="outline" size="lg" className="gap-2 min-h-11" onClick={onCOD}>
            <Banknote className="size-4" />
            <span className="truncate">{t.store.cashOnDelivery}</span>
          </Button>
        </div>
      )}
    </div>
  )
}
