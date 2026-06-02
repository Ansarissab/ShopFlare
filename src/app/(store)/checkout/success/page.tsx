'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { en } from '@/lib/i18n/en'
import { useCart } from '@/hooks/useCart'
import { apiGet } from '@/lib/api'
import { BankTransferInstructions } from '@/components/store/checkout/BankTransferInstructions'

function SuccessContent() {
  const searchParams = useSearchParams()
  const clearCart = useCart((state) => state.clearCart)

  const method = searchParams.get('method')
  const orderId = searchParams.get('orderId')
  const sessionId = searchParams.get('session_id')

  // For Stripe sessions, resolve the orderNumber via the worker API.
  const [resolvedOrderNumber, setResolvedOrderNumber] = useState<string | null>(null)
  const [resolving, setResolving] = useState(false)

  useEffect(() => { clearCart() }, [clearCart])

  useEffect(() => {
    if (!sessionId || orderId) return
    setResolving(true)
    apiGet<{ orderNumber: string }>(`/api/orders/by-session/${sessionId}`)
      .then(({ orderNumber }) => setResolvedOrderNumber(orderNumber))
      .catch(() => {
        // Gracefully handle: track link will just be hidden
        setResolvedOrderNumber(null)
      })
      .finally(() => setResolving(false))
  }, [sessionId, orderId])

  // For COD/bank transfer: orderId param holds the orderNumber (set at submit).
  // For Stripe: use the resolved orderNumber from the API.
  const trackOrderNumber = orderId ?? resolvedOrderNumber

  // Bank transfer: fetch the order total so we can show how much to transfer.
  const [bankTotalCents, setBankTotalCents] = useState<number | null>(null)
  useEffect(() => {
    if (method !== 'bank_transfer' || !trackOrderNumber) return
    apiGet<{ order: { totalCents: number } }>(`/api/orders/track/${trackOrderNumber}`)
      .then(({ order }) => setBankTotalCents(order.totalCents))
      .catch(() => setBankTotalCents(null))
  }, [method, trackOrderNumber])

  const paymentNote =
    method === 'cod'
      ? 'Your order will be confirmed by our team shortly.'
      : method === 'bank_transfer'
        ? en.bankTransfer.awaitingPayment
        : "Payment confirmed. You'll receive an email receipt."

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
      <CheckCircle2 className="size-20 text-[--color-success]" strokeWidth={1.5} aria-hidden />

      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">{en.checkout.orderConfirmed}</h1>
        <p className="text-muted-foreground">{en.checkout.thankYou}</p>
      </div>

      {trackOrderNumber && (
        <p className="rounded-md bg-muted px-4 py-2 text-sm font-medium">
          {en.checkout.orderNumber.replace('{number}', trackOrderNumber)}
        </p>
      )}

      <p className="text-sm text-muted-foreground">{paymentNote}</p>

      {method === 'bank_transfer' && trackOrderNumber && bankTotalCents !== null && (
        <BankTransferInstructions orderNumber={trackOrderNumber} totalCents={bankTotalCents} />
      )}

      <div className="mt-2 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
        {resolving ? (
          <Skeleton className="h-11 w-full rounded-md sm:w-36" />
        ) : trackOrderNumber ? (
          <Link href={`/track/${trackOrderNumber}`} className={cn(buttonVariants({ size: 'lg' }))}>
            {en.tracking.track}
          </Link>
        ) : null}
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
