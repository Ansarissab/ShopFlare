'use client'

import Image from 'next/image'
import { Separator } from '@/components/ui/separator'
import { en } from '@/lib/i18n/en'
import { formatPrice } from '@/lib/utils/index'
import { useCart, useCartSubtotalCents } from '@/hooks/useCart'

export function OrderSummary() {
  const items = useCart((s) => s.items)
  const subtotalCents = useCartSubtotalCents()

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-5 text-card-foreground">
      {/* Item list */}
      <ul className="flex flex-col gap-4">
        {items.map((item) => (
          <li key={item.sizeOptionId} className="flex items-center gap-3">
            {item.imageUrl ? (
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border bg-muted">
                <Image
                  src={item.imageUrl}
                  alt={item.productName}
                  fill
                  className="object-cover"
                  sizes="64px"
                />
              </div>
            ) : (
              <div className="h-16 w-16 shrink-0 rounded-md border bg-muted" />
            )}

            <div className="flex flex-1 flex-col gap-0.5 text-sm">
              <span className="font-medium leading-tight">{item.productName}</span>
              <span className="text-muted-foreground">
                {item.variantLabel} · {item.size}
              </span>
              <span className="text-muted-foreground">
                {en.cart.quantity}: {item.quantity}
              </span>
            </div>

            <span className="shrink-0 text-sm font-semibold">
              {formatPrice(item.priceCents * item.quantity)}
            </span>
          </li>
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
          <span className="text-muted-foreground italic text-xs">Calculated at delivery</span>
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
