'use client'

import Image from 'next/image'
import { MinusIcon, PlusIcon, TrashIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n/Provider'
import { cn } from '@/lib/utils'
import { formatPrice } from '@/lib/utils/index'
import { price as priceStyle } from '@/lib/styles'
import { useCart } from '@/hooks/useCart'
import type { CartItemProps } from '@/lib/types/cart'

export function CartItem({ item }: CartItemProps) {
  const t = useT()
  const { updateQuantity, removeItem } = useCart()

  return (
    <div className={cn('flex gap-3 py-4')}>
      {/* Thumbnail */}
      <div className="relative size-20 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
        <Image
          src={item.imageUrl}
          alt={item.productName}
          fill
          className="object-cover"
          sizes="80px"
        />
      </div>

      {/* Details */}
      <div className="flex flex-1 flex-col gap-1 min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{item.productName}</p>
        <p className="text-xs text-muted-foreground">
          {item.variantLabel} / {item.size}
        </p>
        {item.sku && <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>}

        <div className="mt-auto flex items-center justify-between gap-2">
          {/* Qty controls */}
          <div className="flex items-center rounded-md border border-border">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => updateQuantity(item.sizeOptionId, item.quantity - 1)}
              aria-label={`${t.cart.quantity} -1`}
            >
              <MinusIcon />
            </Button>
            <span className="w-8 text-center text-sm tabular-nums">{item.quantity}</span>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => updateQuantity(item.sizeOptionId, item.quantity + 1)}
              aria-label={`${t.cart.quantity} +1`}
            >
              <PlusIcon />
            </Button>
          </div>

          {/* Price */}
          <span className={cn('text-sm font-semibold text-foreground', priceStyle.mono)}>
            {formatPrice(item.priceCents * item.quantity)}
          </span>

          {/* Remove */}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => removeItem(item.sizeOptionId)}
            aria-label={t.cart.remove}
            className="text-destructive hover:text-destructive"
          >
            <TrashIcon />
          </Button>
        </div>
      </div>
    </div>
  )
}
