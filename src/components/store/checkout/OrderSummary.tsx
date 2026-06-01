'use client'

import { Separator } from '@/components/ui/separator'
import { en } from '@/lib/i18n/en'
import { formatPrice } from '@/lib/utils/index'
import { useCart, useCartSubtotalCents } from '@/hooks/useCart'
import { OrderLineItem } from '@/components/common/OrderLineItem'

export function OrderSummary() {
  const items = useCart((s) => s.items)
  const subtotalCents = useCartSubtotalCents()

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-5 text-card-foreground">
      {/* Item list */}
      <ul className="flex flex-col gap-4">
        {items.map((item) => (
          <OrderLineItem
            key={item.sizeOptionId}
            imageUrl={item.imageUrl}
            productName={item.productName}
            variantLabel={item.variantLabel}
            size={item.size}
            quantity={item.quantity}
            priceCents={item.priceCents}
          />
        ))}
      </ul>

      <Separator />

      {/* Totals */}
      <div className="flex flex-col gap-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{en.cart.subtotal}</span>
          <span>{formatPrice(subtotalCents)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{en.cart.shipping}</span>
          <span className="text-muted-foreground italic text-xs">{en.checkout.calculatedAtDelivery}</span>
        </div>
        <Separator />
        <div className="flex justify-between font-semibold">
          <span>{en.cart.total}</span>
          <span>{formatPrice(subtotalCents)}</span>
        </div>
      </div>
    </div>
  )
}
