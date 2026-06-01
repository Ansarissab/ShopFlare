'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { Button, buttonVariants } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { en } from '@/lib/i18n/en'
import { formatPrice } from '@/lib/utils/index'
import { layout } from '@/lib/styles'
import { cn } from '@/lib/utils'
import type { CancelOrder } from '@/lib/types/store'
import { apiPost } from '@/lib/api'
import { useApiResource } from '@/hooks/useApiResource'

type PageState = 'loading' | 'ready' | 'not_found' | 'cannot_cancel' | 'success' | 'error'

export default function CancelOrderPage() {
  const params = useParams<{ orderId: string }>()

  // GET: load order via hook. The hook covers loading/notFound; we derive
  // cannot_cancel from data.order.status once data arrives.
  const { data: raw, loading: fetching, notFound: fetchNotFound } = useApiResource<{ order: CancelOrder }>(
    params?.orderId ? `/api/orders/track/${params.orderId}` : null,
  )

  const [order, setOrder] = useState<CancelOrder | null>(null)
  const [pageState, setPageState] = useState<PageState>('loading')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  // Translate hook state → pageState machine.
  useEffect(() => {
    if (fetching) { setPageState('loading'); return }
    if (fetchNotFound) { setPageState('not_found'); return }
    if (!raw) return
    const o = raw.order
    setOrder(o)
    if (o.status !== 'pending' && o.status !== 'confirmed') {
      setPageState('cannot_cancel')
    } else {
      setPageState('ready')
    }
  }, [fetching, fetchNotFound, raw])

  async function handleCancel() {
    if (!params?.orderId) return
    setSubmitting(true)
    try {
      await apiPost(`/api/orders/${params.orderId}/cancel`, { reason: reason.trim() || undefined })
      setPageState('success')
    } catch {
      setPageState('error')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading ──
  if (pageState === 'loading') {
    return (
      <div className={cn(layout.formPage, 'gap-4')}>
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
    )
  }

  // ── Not found ──
  if (pageState === 'not_found') {
    return (
      <div className={cn(layout.centeredState, 'max-w-md')}>
        <h1 className="text-xl font-semibold">{en.tracking.notFound}</h1>
        <Link href="/track" className="text-sm text-primary underline-offset-4 hover:underline">
          {en.tracking.backToTracking}
        </Link>
      </div>
    )
  }

  // ── Cannot cancel ──
  if (pageState === 'cannot_cancel') {
    return (
      <div className={cn(layout.centeredState, 'max-w-md')}>
        <h1 className="text-xl font-semibold">{en.checkout.cannotCancel}</h1>
        {order && (
          <p className="text-sm text-muted-foreground capitalize">
            {en.tracking.status}: {en.orderStatusLabels[order.status as keyof typeof en.orderStatusLabels] ?? order.status}
          </p>
        )}
        <Link
          href={`/track/${params?.orderId}`}
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          {en.tracking.viewOrder}
        </Link>
      </div>
    )
  }

  // ── Success ──
  if (pageState === 'success') {
    return (
      <div className={cn(layout.centeredState, 'max-w-md')}>
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-(--success)/15">
          <svg
            className="h-7 w-7 text-(--success)"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <polyline points="20 6 9 17 4 12" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold">{en.checkout.orderCancelled}</h1>
        <p className="text-sm text-muted-foreground">{en.checkout.cancelSuccess}</p>
        <Link href="/" className="text-sm text-primary underline-offset-4 hover:underline">
          {en.store.continueShopping}
        </Link>
      </div>
    )
  }

  // ── Error ──
  if (pageState === 'error') {
    return (
      <div className={cn(layout.centeredState, 'max-w-md')}>
        <h1 className="text-xl font-semibold">{en.errors.networkError}</h1>
        <Button variant="outline" onClick={() => setPageState('ready')}>
          {en.tracking.track}
        </Button>
      </div>
    )
  }

  // ── Ready: confirmation UI ──
  return (
    <div className={layout.formPage}>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{en.checkout.cancelOrder}</h1>
        {order && (
          <p className="text-sm text-muted-foreground">
            {en.checkout.orderNumber.replace('{number}', order.orderNumber)}
            {' · '}
            {formatPrice(order.totalCents)}
          </p>
        )}
      </div>

      <div className="rounded-lg border bg-card p-5 text-card-foreground flex flex-col gap-4">
        <p className="text-sm">{en.checkout.cancelConfirm}</p>

        <Separator />

        {/* Reason textarea */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cancel-reason" className="text-sm font-medium">
            {en.checkout.cancelReason}
          </label>
          <Textarea
            id="cancel-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="resize-none"
            placeholder={en.tracking.cancelReasonPlaceholder}
          />
        </div>

        {/* Confirm toggle */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="cancel-confirm-check"
            checked={confirmed}
            onCheckedChange={(val) => setConfirmed(val === true)}
          />
          <label htmlFor="cancel-confirm-check" className="text-sm cursor-pointer select-none">
            {en.checkout.cancelConfirm}
          </label>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 sm:flex-row-reverse">
        <Button
          variant="destructive"
          className="flex-1"
          disabled={!confirmed || submitting}
          onClick={handleCancel}
        >
          {submitting ? en.tracking.cancelling : en.checkout.cancelOrder}
        </Button>
        <Link
          href={`/track/${params?.orderId}`}
          className={cn(buttonVariants({ variant: 'outline' }), 'flex-1 justify-center')}
        >
          {en.tracking.keepOrder}
        </Link>
      </div>
    </div>
  )
}
