'use client'

// TODO: move OrderLineItemProps to lib/types/store.ts

import Image from 'next/image'
import { formatPrice } from '@/lib/utils/index'
import { en } from '@/lib/i18n/en'

export interface OrderLineItemProps {
  imageUrl?: string | null
  productName: string
  variantLabel: string
  size: string
  quantity: number
  priceCents: number
}

/**
 * Presentational row: size-16 thumbnail + name + variant/size + qty + line total.
 * Used by OrderSummary (cart) and the order-tracking page.
 */
export function OrderLineItem({
  imageUrl,
  productName,
  variantLabel,
  size,
  quantity,
  priceCents,
}: OrderLineItemProps) {
  return (
    <li className="flex items-center gap-3">
      {/* Thumbnail */}
      {imageUrl ? (
        <div className="relative size-16 shrink-0 overflow-hidden rounded-md border bg-muted">
          <Image
            src={imageUrl}
            alt={productName}
            fill
            className="object-cover"
            sizes="64px"
          />
        </div>
      ) : (
        <div className="size-16 shrink-0 rounded-md border bg-muted" />
      )}

      {/* Details */}
      <div className="flex flex-1 flex-col gap-0.5 text-sm">
        <span className="line-clamp-2 font-medium leading-tight">{productName}</span>
        <span className="text-muted-foreground">
          {variantLabel} · {size}
        </span>
        <span className="text-muted-foreground">
          {en.cart.quantity}: {quantity}
        </span>
      </div>

      {/* Line total */}
      <span className="shrink-0 text-sm font-semibold">
        {formatPrice(priceCents * quantity)}
      </span>
    </li>
  )
}
