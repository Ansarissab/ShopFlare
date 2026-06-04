'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { formatPrice, formatDate } from '@/lib/utils/index'
import { en } from '@/lib/i18n/en'
import type { AdminOrder } from '@/lib/types/admin'

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending:    'outline',
  confirmed:  'secondary',
  processing: 'secondary',
  shipped:    'default',
  delivered:  'default',
  cancelled:  'destructive',
}

interface OrdersTableProps {
  orders: AdminOrder[]
}

export function OrdersTable({ orders }: OrdersTableProps) {
  if (orders.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">No orders found.</p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            {['Order', 'Customer', 'Method', 'Status', 'Total', 'Date'].map((h) => (
              <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3 font-mono text-xs">
                <Link href={`/admin/orders/${order.id}`} className="text-primary hover:underline">
                  {order.orderNumber}
                </Link>
              </td>
              <td className="px-4 py-3">
                <p className="font-medium">{order.customerName}</p>
                <p className="text-xs text-muted-foreground">{order.customerEmail ?? order.customerPhone ?? '—'}</p>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {en.paymentMethodLabels[order.paymentMethod as keyof typeof en.paymentMethodLabels] ?? order.paymentMethod}
              </td>
              <td className="px-4 py-3">
                <Badge variant={statusVariant[order.status] ?? 'outline'} className="capitalize">
                  {en.orderStatusLabels[order.status as keyof typeof en.orderStatusLabels] ?? order.status}
                </Badge>
              </td>
              <td className="px-4 py-3 font-medium">{formatPrice(order.totalCents)}</td>
              <td className="px-4 py-3 text-muted-foreground text-xs">
                {formatDate(order.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
