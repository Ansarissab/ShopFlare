'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { HelpTip } from '@/components/common/HelpTip'
import { formatPrice, formatDate } from '@/lib/utils/index'
import { useT } from '@/lib/i18n/Provider'
import { cn } from '@/lib/utils'
import { layout } from '@/lib/styles'
import { useListNavigation } from '@/hooks/useListNavigation'
import { useRegisterListNav } from '@/components/admin/shared/ListNavContext'
import type { AdminOrder } from '@/lib/types/admin'

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'outline',
  confirmed: 'secondary',
  processing: 'secondary',
  shipped: 'default',
  delivered: 'default',
  cancelled: 'destructive',
}

interface OrdersTableProps {
  orders: AdminOrder[]
}

export function OrdersTable({ orders }: OrdersTableProps) {
  const t = useT()
  const router = useRouter()

  const { next, prev, open, isActive } = useListNavigation({
    items: orders,
    onOpen: (order) => router.push(`/admin/orders/${order.id}`),
  })

  useRegisterListNav({ next, prev, open })

  if (orders.length === 0) {
    return <p className={layout.emptyState}>No orders found.</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Order</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Customer</th>
            <th className="hidden sm:table-cell px-4 py-3 text-left font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                Method
                <HelpTip text={t.tooltips.orders.method} />
              </span>
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                Status
                <HelpTip text={t.tooltips.orders.status} />
              </span>
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Total</th>
            <th className="hidden sm:table-cell px-4 py-3 text-left font-medium text-muted-foreground">
              Date
            </th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order, index) => (
            <tr
              key={order.id}
              className={cn(
                'border-b last:border-0 hover:bg-muted/30 transition-colors',
                isActive(index) && layout.activeRow,
              )}
            >
              <td className="px-4 py-3 font-mono text-xs">
                <Link href={`/admin/orders/${order.id}`} className="text-primary hover:underline">
                  {order.orderNumber}
                </Link>
              </td>
              <td className="px-4 py-3">
                <p className="font-medium">{order.customerName}</p>
                <p className="hidden sm:block text-xs text-muted-foreground">
                  {order.customerEmail ?? order.customerPhone ?? '—'}
                </p>
              </td>
              <td className="hidden sm:table-cell px-4 py-3 text-muted-foreground">
                {t.paymentMethodLabels[order.paymentMethod as keyof typeof t.paymentMethodLabels] ??
                  order.paymentMethod}
              </td>
              <td className="px-4 py-3">
                <Badge variant={statusVariant[order.status] ?? 'outline'} className="capitalize">
                  {t.orderStatusLabels[order.status as keyof typeof t.orderStatusLabels] ??
                    order.status}
                </Badge>
              </td>
              <td className="px-4 py-3 font-medium whitespace-nowrap">
                {formatPrice(order.totalCents)}
              </td>
              <td className="hidden sm:table-cell px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                {formatDate(order.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
