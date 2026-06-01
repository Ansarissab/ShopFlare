'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { en } from '@/lib/i18n/en'
import { useCart } from '@/hooks/useCart'

export default function CheckoutSuccessPage() {
  const searchParams = useSearchParams()
  const clearCart = useCart((state) => state.clearCart)

  const method = searchParams.get('method')   // 'stripe' | 'cod'
  const orderId = searchParams.get('orderId') // present for COD
  const sessionId = searchParams.get('session_id') // present for Stripe

  // Derive a display order number where possible
  const displayOrderId = orderId ?? sessionId

  useEffect(() => {
    clearCart()
  }, [clearCart])

  const isCOD = method === 'cod'
  const paymentNote = isCOD
    ? 'Your order will be confirmed by our team shortly.'
    : "Payment confirmed. You'll receive an email receipt."

  return (
    <main className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 py-16">
      <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
        {/* Success icon */}
        <CheckCircle2
          className="size-20 text-[--color-success]"
          strokeWidth={1.5}
          aria-hidden="true"
        />

        {/* Heading */}
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">
            {en.checkout.orderConfirmed}
          </h1>
          <p className="text-muted-fg">{en.checkout.thankYou}</p>
        </div>

        {/* Order number */}
        {displayOrderId && (
          <p className="rounded-md bg-[--color-muted] px-4 py-2 text-sm font-medium">
            {en.checkout.orderNumber.replace('{number}', displayOrderId)}
          </p>
        )}

        {/* Payment-method note */}
        <p className="text-sm text-[--color-muted-fg]">{paymentNote}</p>

        {/* CTA buttons */}
        <div className="mt-2 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          {displayOrderId && (
            <Link
              href={`/track/${displayOrderId}`}
              className={cn(buttonVariants({ size: 'lg' }))}
            >
              {en.tracking.title}
            </Link>
          )}
          <Link
            href="/"
            className={cn(buttonVariants({ variant: 'outline', size: 'lg' }))}
          >
            {en.store.continueShopping}
          </Link>
        </div>
      </div>
    </main>
  )
}
