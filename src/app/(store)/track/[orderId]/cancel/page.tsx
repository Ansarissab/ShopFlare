'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { Button, buttonVariants } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { en } from '@/lib/i18n/en'
import { formatPrice } from '@/lib/utils/index'
import type { OrderStatus } from '@/lib/constants'

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? ''

interface CancelOrder {
  orderNumber: string
  status: OrderStatus
  customerName: string
  totalCents: number
}

type PageState = 'loading' | 'ready' | 'not_found' | 'cannot_cancel' | 'success' | 'error'

export default function CancelOrderPage() {
  const params = useParams<{ orderId: string }>()
  const [order, setOrder] = useState<CancelOrder | null>(null)
  const [pageState, setPageState] = useState<PageState>('loading')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    if (!params?.orderId) return

    async function fetchOrder() {
      try {
        const res = await fetch(`${WORKER_URL}/api/orders/track/${params.orderId}`)
        if (res.status === 404) {
          setPageState('not_found')
          return
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json() as { order: CancelOrder }
        const o = json.order
        if (o.status !== 'pending' && o.status !== 'confirmed') {
          setOrder(o)
          setPageState('cannot_cancel')
          return
        }
        setOrder(o)
        setPageState('ready')
      } catch {
        setPageState('not_found')
      }
    }

    fetchOrder()
  }, [params?.orderId])

  async function handleCancel() {
    if (!params?.orderId) return
    setSubmitting(true)
    try {
      const res = await fetch(`${WORKER_URL}/api/orders/${params.orderId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
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
      <div className="mx-auto max-w-md px-4 py-12 flex flex-col gap-4">
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
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="text-xl font-semibold">{en.tracking.notFound}</h1>
        <Link href="/track" className="text-sm text-primary underline-offset-4 hover:underline">
          Back to tracking
        </Link>
      </div>
    )
  }

  // ── Cannot cancel ──
  if (pageState === 'cannot_cancel') {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="text-xl font-semibold">{en.checkout.cannotCancel}</h1>
        {order && (
          <p className="text-sm text-muted-foreground capitalize">
            Current status: {order.status}
          </p>
        )}
        <Link
          href={`/track/${params?.orderId}`}
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          View order
        </Link>
      </div>
    )
  }

  // ── Success ──
  if (pageState === 'success') {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
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
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="text-xl font-semibold">{en.errors.networkError}</h1>
        <Button variant="outline" onClick={() => setPageState('ready')}>
          Try again
        </Button>
      </div>
    )
  }

  // ── Ready: confirmation UI ──
  return (
    <div className="mx-auto max-w-md px-4 py-12 flex flex-col gap-6">
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
          <textarea
            id="cancel-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            placeholder="Optional — tell us why you're cancelling"
          />
        </div>

        {/* Confirm toggle */}
        <div className="flex items-center gap-2">
          <input
            id="cancel-confirm-check"
            type="checkbox"
            className="h-4 w-4 rounded border accent-(--accent)"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
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
          {submitting ? 'Cancelling…' : en.checkout.cancelOrder}
        </Button>
        <Link
          href={`/track/${params?.orderId}`}
          className={buttonVariants({ variant: 'outline' }) + ' flex-1 justify-center'}
        >
          Keep Order
        </Link>
      </div>
    </div>
  )
}
