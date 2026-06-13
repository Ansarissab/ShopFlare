'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { useT } from '@/lib/i18n/Provider'
import { cn } from '@/lib/utils'
import { formatPrice, calculateGrandTotal } from '@/lib/utils/index'
import type { CartSummaryProps } from '@/lib/types/cart'

export function CartSummary({
  subtotalCents,
  shippingCents,
  onApplyCoupon,
  couponApplied = false,
  discountCents = 0,
  taxCents = 0,
  taxName = 'Tax',
  taxRate = 0,
  taxInclusive = false,
  onClose,
}: CartSummaryProps) {
  const t = useT()
  const router = useRouter()
  const [couponCode, setCouponCode] = useState('')
  const [couponState, setCouponState] = useState<'idle' | 'applied' | 'invalid'>('idle')
  const [applying, setApplying] = useState(false)

  const totalCents = calculateGrandTotal(
    subtotalCents,
    shippingCents,
    discountCents,
    taxCents,
    taxInclusive,
  )

  async function handleApplyCoupon() {
    if (!couponCode.trim()) return
    setApplying(true)
    const ok = await onApplyCoupon(couponCode.trim())
    setCouponState(ok ? 'applied' : 'invalid')
    setApplying(false)
  }

  // Reset coupon state when code changes
  function handleCouponChange(e: React.ChangeEvent<HTMLInputElement>) {
    setCouponCode(e.target.value)
    if (couponState !== 'idle') setCouponState('idle')
  }

  function handleCheckout() {
    onClose()
    router.push('/checkout')
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Coupon */}
      <div className="flex gap-2">
        <Input
          placeholder={t.cart.couponPlaceholder}
          value={couponCode}
          onChange={handleCouponChange}
          aria-label={t.cart.couponPlaceholder}
          className={cn(
            couponApplied || couponState === 'applied'
              ? 'border-success focus-visible:ring-success/30'
              : couponState === 'invalid'
                ? 'aria-invalid'
                : '',
          )}
          aria-invalid={couponState === 'invalid'}
          disabled={couponApplied || couponState === 'applied'}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleApplyCoupon}
          disabled={applying || couponApplied || couponState === 'applied' || !couponCode.trim()}
        >
          {t.cart.applyCoupon}
        </Button>
      </div>

      {/* Feedback */}
      {(couponApplied || couponState === 'applied') && (
        <p className="text-xs font-medium text-success">{t.cart.couponApplied}</p>
      )}
      {couponState === 'invalid' && (
        <p className="text-xs text-destructive">{t.cart.couponInvalid}</p>
      )}

      <Separator />

      {/* Totals */}
      <div className="flex flex-col gap-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t.cart.subtotal}</span>
          <span>{formatPrice(subtotalCents)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t.cart.shipping}</span>
          <span>{shippingCents === 0 ? t.cart.shippingFree : formatPrice(shippingCents)}</span>
        </div>
        {taxCents > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {taxInclusive
                ? t.cart.taxIncluded.replace('{name}', taxName)
                : t.cart.taxRateLabel.replace('{name}', taxName).replace('{rate}', String(taxRate))}
            </span>
            <span className={taxInclusive ? 'text-xs text-muted-foreground' : ''}>
              {formatPrice(taxCents)}
            </span>
          </div>
        )}
        {discountCents > 0 && (
          <div className="flex justify-between text-success">
            <span>{t.cart.couponApplied}</span>
            <span>-{formatPrice(discountCents)}</span>
          </div>
        )}
        <Separator />
        <div className="flex justify-between font-semibold">
          <span>{t.cart.total}</span>
          <span>{formatPrice(totalCents)}</span>
        </div>
      </div>

      {/* CTAs */}
      <Button size="lg" className="w-full" onClick={handleCheckout}>
        {t.store.checkout}
      </Button>
      <Button variant="ghost" size="sm" className="w-full" onClick={onClose}>
        {t.store.continueShopping}
      </Button>
    </div>
  )
}
