'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { OrderTimeline } from '@/components/store/tracking/OrderTimeline'
import { OrderLineItem } from '@/components/common/OrderLineItem'
import { en } from '@/lib/i18n/en'
import { formatPrice } from '@/lib/utils/index'
import { layout } from '@/lib/styles'
import { cn } from '@/lib/utils'
import type { TrackingData } from '@/lib/types/store'
import { useApiResource } from '@/hooks/useApiResource'

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

export default function OrderTrackingPage() {
  const params = useParams<{ orderId: string }>()
  const { data, loading, notFound } = useApiResource<TrackingData>(
    params?.orderId ? `/api/orders/track/${params.orderId}` : null,
  )

  if (loading) return <TrackingSkeleton />

  if (notFound || !data) {
    return (
      <div className={cn(layout.centeredState, 'max-w-2xl')}>
        <h1 className="text-2xl font-semibold tracking-tight">{en.tracking.notFound}</h1>
        <p className="text-sm text-muted-foreground">
          {en.tracking.notFoundBody}
        </p>
        <Link href="/track" className="text-sm text-primary underline-offset-4 hover:underline">
          Back to tracking
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
            {en.checkout.orderNumber.replace('{number}', order.orderNumber)}
          </h1>
          <Badge variant="secondary" className="capitalize">
            {en.paymentMethodLabels[order.paymentMethod as keyof typeof en.paymentMethodLabels] ?? order.paymentMethod}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {new Date(order.createdAt).toLocaleDateString('en', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
        <p className="text-sm text-muted-foreground">{order.customerName}</p>
      </div>

      <Separator />

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
        <h2 className="text-sm font-medium text-muted-foreground">Items</h2>
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
          <span className="text-muted-foreground">{en.cart.subtotal}</span>
          <span>{formatPrice(order.subtotalCents)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{en.cart.shipping}</span>
          <span>
            {order.shippingCents === 0 ? en.cart.shippingFree : formatPrice(order.shippingCents)}
          </span>
        </div>
        <Separator />
        <div className="flex justify-between font-semibold text-base">
          <span>{en.cart.total}</span>
          <span>{formatPrice(order.totalCents)}</span>
        </div>
      </div>

      {/* Cancel button */}
      {canCancel && (
        <Link
          href={`/track/${params.orderId}/cancel`}
          className={buttonVariants({ variant: 'outline' }) + ' w-full border-destructive text-destructive hover:bg-destructive/10 justify-center'}
        >
          {en.checkout.cancelOrder}
        </Link>
      )}
    </div>
  )
}
