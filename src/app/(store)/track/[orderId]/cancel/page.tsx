'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button, buttonVariants } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { TurnstileWidget } from '@/components/store/checkout/TurnstileWidget'
import { en } from '@/lib/i18n/en'
import { formatPrice } from '@/lib/utils/index'
import { layout } from '@/lib/styles'
import { cn } from '@/lib/utils'
import type { CancelOrder } from '@/lib/types/order'
import { apiPost } from '@/lib/api'
import { useApiResource } from '@/hooks/useApiResource'

type PageState =
  | 'loading'
  | 'verify_contact'
  | 'ready'
  | 'not_found'
  | 'cannot_cancel'
  | 'success'
  | 'error'

// User-driven phase. The data-derived phases (loading/ready/not_found/
// cannot_cancel) are computed during render from the fetch hook; this enum only
// tracks transitions the user causes (verify → data → success/error).
type Phase = 'verify' | 'data' | 'success' | 'error'

function CancelOrderContent() {
  const params = useParams<{ orderId: string }>()
  const searchParams = useSearchParams()

  // ?c carries the phone/email forwarded from the track page.
  const [contact, setContact] = useState(searchParams.get('c') ?? '')
  const [contactInput, setContactInput] = useState('')

  // Only fetch once we have a contact — avoids a no-contact fetch that returns
  // an order without PII, then a second fetch after the user enters contact.
  const [fetchContact, setFetchContact] = useState(searchParams.get('c') ?? '')

  const apiPath =
    params?.orderId && fetchContact
      ? `/api/orders/track/${params.orderId}?contact=${encodeURIComponent(fetchContact)}`
      : null

  const {
    data: raw,
    loading: fetching,
    notFound: fetchNotFound,
    error: fetchError,
  } = useApiResource<{ order: CancelOrder }>(apiPath)

  const [phase, setPhase] = useState<Phase>(!contact ? 'verify' : 'data')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileError, setTurnstileError] = useState(false)

  // `order` and the data-derived page state are computed during render from the
  // fetch hook — no effect needed to mirror them into state.
  const order: CancelOrder | null = raw?.order ?? null

  let pageState: PageState
  if (phase === 'verify') {
    pageState = 'verify_contact'
  } else if (phase === 'success') {
    pageState = 'success'
  } else if (phase === 'error') {
    pageState = 'error'
  } else if (fetching) {
    pageState = 'loading'
  } else if (fetchNotFound || fetchError) {
    pageState = 'not_found'
  } else if (!raw) {
    pageState = 'loading'
  } else if (order && order.status !== 'pending' && order.status !== 'confirmed') {
    pageState = 'cannot_cancel'
  } else {
    pageState = 'ready'
  }

  function submitContact() {
    const val = contactInput.trim()
    if (!val) return
    setContact(val)
    setFetchContact(val)
    setPhase('data')
  }

  async function handleCancel() {
    if (!params?.orderId) return
    setSubmitting(true)
    try {
      await apiPost(
        `/api/orders/${params.orderId}/cancel`,
        { contact, reason: reason.trim() || undefined },
        { headers: { 'X-Turnstile-Token': turnstileToken ?? '' } },
      )
      setPhase('success')
    } catch {
      // Reset Turnstile so the user can retry with a fresh token.
      setTurnstileToken(null)
      setPhase('error')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Verify contact ──
  if (pageState === 'verify_contact') {
    return (
      <div className={cn(layout.formPage, 'max-w-md')}>
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">{en.checkout.cancelOrder}</h1>
          <p className="text-sm text-muted-foreground">{en.tracking.verifyContactPrompt}</p>
        </div>
        <Input
          type="text"
          autoComplete="email tel"
          placeholder={en.tracking.contactPlaceholder}
          value={contactInput}
          onChange={(e) => setContactInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submitContact()}
        />
        <Button onClick={submitContact} disabled={!contactInput.trim()}>
          {en.tracking.track}
        </Button>
      </div>
    )
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
            {en.tracking.status}:{' '}
            {en.orderStatusLabels[order.status as keyof typeof en.orderStatusLabels] ??
              order.status}
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
            <polyline
              points="20 6 9 17 4 12"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
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
        <Button variant="outline" onClick={() => setPhase('data')}>
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

      <div className="rounded-lg border bg-card p-4 sm:p-5 text-card-foreground flex flex-col gap-4">
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
            onCheckedChange={(val: boolean) => setConfirmed(val === true)}
          />
          <label htmlFor="cancel-confirm-check" className="text-sm cursor-pointer select-none">
            {en.checkout.cancelConfirm}
          </label>
        </div>
      </div>

      {/* Turnstile */}
      <TurnstileWidget
        onVerify={(token) => {
          setTurnstileToken(token)
          setTurnstileError(false)
        }}
        onError={() => {
          setTurnstileToken(null)
          setTurnstileError(true)
        }}
      />
      {turnstileError && (
        <p className="text-xs text-destructive">{en.checkout.securityCheckFailed}</p>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3 sm:flex-row-reverse">
        <Button
          variant="destructive"
          className="flex-1"
          disabled={!confirmed || submitting || !turnstileToken}
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

export default function CancelOrderPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full max-w-md rounded-xl" />}>
      <CancelOrderContent />
    </Suspense>
  )
}
