'use client'

import { useState } from 'react'
import { OrdersTable } from '@/components/admin/orders/OrdersTable'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useT } from '@/lib/i18n/Provider'
import { ORDER_STATUSES } from '@/lib/constants'
import { useApiResource } from '@/hooks/useApiResource'
import type { AdminOrdersResponse } from '@/lib/types/admin'

export default function AdminOrdersPage() {
  const t = useT()
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const queryString = statusFilter !== 'all' ? `?status=${statusFilter}&limit=50` : '?limit=50'
  const { data, loading } = useApiResource<AdminOrdersResponse>(`/api/admin/orders${queryString}`)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t.admin.orders}</h1>

        <Select
          value={statusFilter}
          onValueChange={(v: string | null) => setStatusFilter(v ?? 'all')}
        >
          <SelectTrigger className="w-40" aria-label={t.admin.filterByStatus}>
            <SelectValue placeholder={t.admin.allStatuses} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {ORDER_STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {t.orderStatusLabels[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      ) : (
        <OrdersTable orders={data?.orders ?? []} />
      )}

      {data && (
        <p className="text-xs text-muted-foreground">
          Showing {data.orders.length} of {data.total} orders
        </p>
      )}
    </div>
  )
}
