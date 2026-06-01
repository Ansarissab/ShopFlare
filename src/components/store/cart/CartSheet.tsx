'use client'

import Link from 'next/link'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { en } from '@/lib/i18n/en'
import { calculateShipping } from '@/lib/utils/index'
import { useCart, useCartSubtotalCents } from '@/hooks/useCart'
import { CartItem } from '@/components/store/cart/CartItem'
import { FreeShippingBar } from '@/components/store/cart/FreeShippingBar'
import { CartSummary } from '@/components/store/cart/CartSummary'
import type { CartSheetProps } from '@/lib/types/store'

export function CartSheet({ flatRateCents = 0, thresholdCents = 0 }: CartSheetProps) {
  const { items, isOpen, closeCart } = useCart()
  const subtotalCents = useCartSubtotalCents()
  const shippingCents = calculateShipping(subtotalCents, flatRateCents, thresholdCents)

  async function handleApplyCoupon(_code: string): Promise<boolean> {
    // Coupon validation will be wired to the Worker API; return false for now
    return false
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) closeCart() }}>
      <SheetContent side="right" className="flex flex-col p-0 sm:max-w-md w-full">
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle>{en.cart.title}</SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
            <p className="text-muted-foreground">{en.cart.empty}</p>
            <Link
              href="/"
              onClick={closeCart}
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              {en.store.continueShopping}
            </Link>
          </div>
        ) : (
          <>
            {/* Item list */}
            <ScrollArea className="flex-1 px-4">
              <div className="divide-y divide-border">
                {items.map((item) => (
                  <CartItem key={item.sizeOptionId} item={item} />
                ))}
              </div>
            </ScrollArea>

            {/* Free shipping bar */}
            <div className="px-4 py-2">
              <FreeShippingBar
                subtotalCents={subtotalCents}
                thresholdCents={thresholdCents}
                flatRateCents={flatRateCents}
              />
            </div>

            <Separator />

            {/* Summary + checkout */}
            <div className="px-4 py-4">
              <CartSummary
                subtotalCents={subtotalCents}
                shippingCents={shippingCents}
                onApplyCoupon={handleApplyCoupon}
                onClose={closeCart}
              />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
