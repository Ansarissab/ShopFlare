'use client'

import Link from 'next/link'
import { toast } from 'sonner'
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
import { apiPost, ApiError } from '@/lib/api'
import { CartItem } from '@/components/store/cart/CartItem'
import { FreeShippingBar } from '@/components/store/cart/FreeShippingBar'
import { CartSummary } from '@/components/store/cart/CartSummary'
import type { CartSheetProps } from '@/lib/types/cart'

export function CartSheet({ flatRateCents = 0, thresholdCents = 0 }: CartSheetProps) {
  const { items, isOpen, closeCart } = useCart()
  const subtotalCents = useCartSubtotalCents()
  const shippingCents = calculateShipping(subtotalCents, flatRateCents, thresholdCents)

  const discountCents = useCart((s) => s.discountCents)
  const couponApplied = useCart((s) => s.couponCode !== null)
  const applyCoupon = useCart((s) => s.applyCoupon)

  async function handleApplyCoupon(code: string): Promise<boolean> {
    try {
      const result = await apiPost<{ valid: boolean; discountCents: number; message?: string }>(
        '/api/coupons/validate',
        { code, subtotalCents },
      )
      if (result.valid) {
        applyCoupon(code, result.discountCents)
        return true
      }
      toast.error(result.message ?? en.cart.couponInvalid)
      return false
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : en.cart.couponInvalid
      toast.error(msg)
      return false
    }
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
                couponApplied={couponApplied}
                discountCents={discountCents}
                onClose={closeCart}
              />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
