'use client'

import { Separator } from '@/components/ui/separator'
import { en } from '@/lib/i18n/en'
import {
  formatPrice,
  calculateShipping,
  calculateTax,
  calculateGrandTotal,
} from '@/lib/utils/index'
import { useCart, useCartSubtotalCents } from '@/hooks/useCart'
import { useStoreConfig } from '@/hooks/useStoreConfig'
import { OrderLineItem } from '@/components/common/OrderLineItem'

export function OrderSummary() {
  const items = useCart((s) => s.items)
  const discountCents = useCart((s) => s.discountCents)
  const subtotalCents = useCartSubtotalCents()
  const { config } = useStoreConfig()

  const flatRateCents = config?.flatShippingRateCents ?? 0
  const thresholdCents = config?.freeShippingThresholdCents ?? 0
  const shippingCents = calculateShipping(subtotalCents, flatRateCents, thresholdCents)

  const taxEnabled = config?.taxEnabled ?? false
  const taxRate = config?.taxRate ?? 0
  const taxName = config?.taxName ?? 'Tax'
  const taxInclusive = config?.taxInclusive ?? false
  const taxBasis = config?.taxBasis ?? 'subtotal'

  const taxCents = taxEnabled
    ? calculateTax({ subtotalCents, shippingCents, discountCents, taxRate, taxInclusive, taxBasis })
    : 0

  const totalCents = calculateGrandTotal(
    subtotalCents,
    shippingCents,
    discountCents,
    taxCents,
    taxInclusive,
  )

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-4 sm:p-5 text-card-foreground">
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
          <span>{shippingCents === 0 ? en.cart.shippingFree : formatPrice(shippingCents)}</span>
        </div>
        {taxEnabled && taxCents > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {taxInclusive
                ? en.cart.taxIncluded.replace('{name}', taxName)
                : en.cart.taxRateLabel
                    .replace('{name}', taxName)
                    .replace('{rate}', String(taxRate))}
            </span>
            <span className={taxInclusive ? 'text-xs text-muted-foreground' : ''}>
              {formatPrice(taxCents)}
            </span>
          </div>
        )}
        {discountCents > 0 && (
          <div className="flex justify-between text-success">
            <span>{en.cart.couponApplied}</span>
            <span>-{formatPrice(discountCents)}</span>
          </div>
        )}
        <Separator />
        <div className="flex justify-between font-semibold">
          <span>{en.cart.total}</span>
          <span>{formatPrice(totalCents)}</span>
        </div>
      </div>
    </div>
  )
}
