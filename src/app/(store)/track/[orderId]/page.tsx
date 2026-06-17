'use client'

import { Suspense, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { OrderTimeline } from '@/components/store/tracking/OrderTimeline'
import { OrderLineItem } from '@/components/common/OrderLineItem'
import { BankTransferInstructions } from '@/components/store/checkout/BankTransferInstructions'
import { useT } from '@/lib/i18n/Provider'
import { formatPrice, formatDate } from '@/lib/utils/index'
import { layout } from '@/lib/styles'
import { cn } from '@/lib/utils'
import type { TrackingData } from '@/lib/types/order'
import { useApiResource } from '@/hooks/useApiResource'
import { OrderPushOptIn } from '@/components/pwa/OrderPushOptIn'

function TrackingSkeleton() {
  return (
    <div className={layout.detailPage}>
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-32" />
      <div className="flex flex-col gap-3 rounded-lg border p-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="h-4 w-28" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-16 rounded-md" />
            <div className="flex flex-col gap-1.5 flex-1">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function OrderTrackingContent() {
  const t = useT()
  const params = useParams<{ orderId: string }>()
  const searchParams = useSearchParams()

  // Clear app badge when user views their order
  useEffect(() => {
    if ('clearAppBadge' in navigator) {
      ;(navigator as Navigator & { clearAppBadge(): Promise<void> }).clearAppBadge().catch(() => {})
    }
  }, [])
  const contact = searchParams.get('c') ?? ''

  const apiPath = params?.orderId
    ? `/api/orders/track/${params.orderId}${contact ? `?contact=${encodeURIComponent(contact)}` : ''}`
    : null

  const { data, loading, error, notFound } = useApiResource<TrackingData>(apiPath)

  if (loading) return <TrackingSkeleton />

  // 403 — contact mismatch; surface the API error message rather than "not found"
  if (error) {
    return (
      <div className={cn(layout.centeredState, 'max-w-2xl')}>
        <h1 className="text-2xl font-semibold tracking-tight">{t.tracking.notFound}</h1>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Link href="/track" className="text-sm text-primary underline-offset-4 hover:underline">
          {t.tracking.backToTracking}
        </Link>
      </div>
    )
  }

  if (notFound || !data) {
    return (
      <div className={cn(layout.centeredState, 'max-w-2xl')}>
        <h1 className="text-2xl font-semibold tracking-tight">{t.tracking.notFound}</h1>
        <p className="text-sm text-muted-foreground">{t.tracking.notFoundBody}</p>
        <Link href="/track" className="text-sm text-primary underline-offset-4 hover:underline">
          {t.tracking.backToTracking}
        </Link>
      </div>
    )
  }

  const { order, items } = data
  const canCancel = order.status === 'pending' || order.status === 'confirmed'

  return (
    <div className={layout.detailPage}>
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-xl font-semibold tracking-tight">
            {t.checkout.orderNumber.replace('{number}', order.orderNumber)}
          </h1>
          <Badge variant="secondary" className="capitalize">
            {t.paymentMethodLabels[order.paymentMethod as keyof typeof t.paymentMethodLabels] ??
              order.paymentMethod}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {formatDate(order.createdAt, { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
        <p className="text-sm text-muted-foreground">{order.customerName}</p>
      </div>

      <Separator />

      {/* Push notification opt-in */}
      <OrderPushOptIn orderNumber={order.orderNumber} />

      {/* Timeline */}
      <div className="rounded-lg border bg-card p-5 text-card-foreground">
        <OrderTimeline
          status={order.status}
          trackingNumber={order.trackingNumber}
          carrier={order.carrier}
        />
      </div>

      {/* Items */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">{t.checkout.itemsHeading}</h2>
        <ul className="flex flex-col gap-3">
          {items.map((item, idx) => (
            <OrderLineItem
              key={idx}
              imageUrl={item.snapshot.imageUrl}
              productName={item.snapshot.productName}
              variantLabel={item.snapshot.variantLabel}
              size={item.snapshot.size}
              quantity={item.quantity}
              priceCents={item.priceCents}
            />
          ))}
        </ul>
      </div>

      <Separator />

      {/* Totals */}
      <div className="flex flex-col gap-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t.cart.subtotal}</span>
          <span>{formatPrice(order.subtotalCents)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t.cart.shipping}</span>
          <span>
            {order.shippingCents === 0 ? t.cart.shippingFree : formatPrice(order.shippingCents)}
          </span>
        </div>
        {order.discountCents > 0 && (
          <div className="flex justify-between text-success">
            <span>{t.cart.couponApplied}</span>
            <span>-{formatPrice(order.discountCents)}</span>
          </div>
        )}
        {order.taxCents > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t.cart.tax}</span>
            <span>{formatPrice(order.taxCents)}</span>
          </div>
        )}
        <Separator />
        <div className="flex justify-between font-semibold text-base">
          <span>{t.cart.total}</span>
          <span>{formatPrice(order.totalCents)}</span>
        </div>
      </div>

      {/* Bank-transfer instructions — only while payment is still awaited */}
      {order.paymentMethod === 'bank_transfer' && order.status === 'pending' && (
        <BankTransferInstructions orderNumber={order.orderNumber} totalCents={order.totalCents} />
      )}

      {/* Cancel button */}
      {canCancel && (
        <Link
          href={`/track/${params.orderId}/cancel${contact ? `?c=${encodeURIComponent(contact)}` : ''}`}
          className={
            buttonVariants({ variant: 'outline' }) +
            ' w-full border-destructive text-destructive hover:bg-destructive/10 justify-center'
          }
        >
          {t.checkout.cancelOrder}
        </Link>
      )}
    </div>
  )
}

export default function OrderTrackingPage() {
  return (
    <Suspense fallback={<TrackingSkeleton />}>
      <OrderTrackingContent />
    </Suspense>
  )
}
