'use client'

import { Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { en } from '@/lib/i18n/en'
import { useCart } from '@/hooks/useCart'

function SuccessContent() {
  const searchParams = useSearchParams()
  const clearCart = useCart((state) => state.clearCart)

  const method = searchParams.get('method')
  const orderId = searchParams.get('orderId')
  const sessionId = searchParams.get('session_id')
  const displayOrderId = orderId ?? sessionId

  useEffect(() => { clearCart() }, [clearCart])

  const paymentNote = method === 'cod'
    ? 'Your order will be confirmed by our team shortly.'
    : "Payment confirmed. You'll receive an email receipt."

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
      <CheckCircle2 className="size-20 text-[--color-success]" strokeWidth={1.5} aria-hidden />

      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">{en.checkout.orderConfirmed}</h1>
        <p className="text-muted-foreground">{en.checkout.thankYou}</p>
      </div>

      {displayOrderId && (
        <p className="rounded-md bg-muted px-4 py-2 text-sm font-medium">
          {en.checkout.orderNumber.replace('{number}', displayOrderId)}
        </p>
      )}

      <p className="text-sm text-muted-foreground">{paymentNote}</p>

      <div className="mt-2 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
        {displayOrderId && (
          <Link href={`/track/${displayOrderId}`} className={cn(buttonVariants({ size: 'lg' }))}>
            {en.tracking.track}
          </Link>
        )}
        <Link href="/" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }))}>
          {en.store.continueShopping}
        </Link>
      </div>
    </div>
  )
}

export default function CheckoutSuccessPage() {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 py-16">
      <Suspense fallback={<Skeleton className="h-64 w-full max-w-md rounded-xl" />}>
        <SuccessContent />
      </Suspense>
    </main>
  )
}
