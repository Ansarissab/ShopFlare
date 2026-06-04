'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { OrderLineItem } from '@/components/common/OrderLineItem'
import { cn } from '@/lib/utils'
import { en } from '@/lib/i18n/en'
import { formatPrice } from '@/lib/utils/index'
import { ORDER_STATUSES } from '@/lib/constants'
import { apiPatch } from '@/lib/api'
import { useApiResource } from '@/hooks/useApiResource'
import type { AdminOrderDetail } from '@/lib/types/admin'

export default function AdminOrderDetailPage() {
  const params = useParams<{ id: string }>()
  const { data, loading, notFound } = useApiResource<AdminOrderDetail>(
    params?.id ? `/api/admin/orders/${params.id}` : null,
  )

  const [newStatus, setNewStatus] = useState<string>('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [carrier, setCarrier] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleStatusUpdate() {
    if (!newStatus || !params?.id) return
    setSaving(true)
    try {
      await apiPatch(`/api/admin/orders/${params.id}/status`, { status: newStatus })
      toast.success(en.admin.statusUpdated)
      window.location.reload()
    } catch {
      toast.error(en.errors.networkError)
    } finally {
      setSaving(false)
    }
  }

  async function handleTrackingUpdate() {
    if (!trackingNumber.trim() || !params?.id) return
    setSaving(true)
    try {
      await apiPatch(`/api/admin/orders/${params.id}/tracking`, {
        trackingNumber: trackingNumber.trim(),
        carrier: carrier.trim() || undefined,
      })
      toast.success(en.admin.trackingAdded)
      window.location.reload()
    } catch {
      toast.error(en.errors.networkError)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4 max-w-3xl">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (notFound || !data) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <p className="text-muted-foreground">Order not found.</p>
        <Link href="/admin/orders" className="text-sm text-primary underline">
          Back to orders
        </Link>
      </div>
    )
  }

  const { order, items, shippingAddress } = data

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/orders" className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }))}>
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="text-xl font-bold tracking-tight">
          {en.admin.orderDetail} — {order.orderNumber}
        </h1>
        <Badge variant="secondary" className="capitalize ml-auto">
          {en.orderStatusLabels[order.status as keyof typeof en.orderStatusLabels] ?? order.status}
        </Badge>
      </div>

      {/* Customer info */}
      <div className="rounded-lg border p-4 flex flex-col gap-1 text-sm">
        <p className="font-medium">{order.customerName}</p>
        {order.customerEmail && <p className="text-muted-foreground">{order.customerEmail}</p>}
        {order.customerPhone && <p className="text-muted-foreground">{order.customerPhone}</p>}
        {shippingAddress && (
          <p className="text-muted-foreground mt-1">
            {[shippingAddress.address, shippingAddress.city, shippingAddress.state, shippingAddress.country]
              .filter(Boolean)
              .join(', ')}
          </p>
        )}
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
          <span>{order.shippingCents === 0 ? en.cart.shippingFree : formatPrice(order.shippingCents)}</span>
        </div>
        {order.discountCents > 0 && (
          <div className="flex justify-between text-green-600">
            <span>Discount {order.couponCode ? `(${order.couponCode})` : ''}</span>
            <span>-{formatPrice(order.discountCents)}</span>
          </div>
        )}
        {order.taxCents > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">{en.cart.tax}</span>
            <span>{formatPrice(order.taxCents)}</span>
          </div>
        )}
        <Separator />
        <div className="flex justify-between font-semibold text-base">
          <span>{en.cart.total}</span>
          <span>{formatPrice(order.totalCents)}</span>
        </div>
      </div>

      <Separator />

      {/* Admin actions */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Status update */}
        <div className="flex flex-col gap-2 rounded-lg border p-4">
          <p className="text-sm font-medium">{en.admin.updateStatus}</p>
          <Select value={newStatus} onValueChange={(v: string | null) => setNewStatus(v ?? '')}>
            <SelectTrigger>
              <SelectValue placeholder={en.orderStatusLabels[order.status as keyof typeof en.orderStatusLabels] ?? order.status} />
            </SelectTrigger>
            <SelectContent>
              {ORDER_STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {en.orderStatusLabels[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={handleStatusUpdate}
            disabled={!newStatus || saving}
            className="mt-auto"
          >
            {saving ? en.admin.saving : en.admin.updateStatus}
          </Button>
        </div>

        {/* Tracking */}
        <div className="flex flex-col gap-2 rounded-lg border p-4">
          <p className="text-sm font-medium">{en.admin.addTracking}</p>
          <Input
            placeholder={en.admin.trackingNumber}
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
          />
          <Input
            placeholder={`${en.admin.carrier} ${en.common.optional}`}
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
          />
          <Button
            size="sm"
            onClick={handleTrackingUpdate}
            disabled={!trackingNumber.trim() || saving}
            className="mt-auto"
          >
            {saving ? en.admin.saving : en.admin.addTracking}
          </Button>
        </div>
      </div>

      {order.trackingNumber && (
        <div className="rounded-lg border bg-muted/40 p-4 text-sm">
          <p className="font-medium">{en.admin.trackingNumber}: {order.trackingNumber}</p>
          {order.carrier && <p className="text-muted-foreground">{en.admin.carrier}: {order.carrier}</p>}
        </div>
      )}
    </div>
  )
}
