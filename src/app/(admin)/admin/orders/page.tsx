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
import { useT } from '@/lib/i18n/Provider'
import { ORDER_STATUSES } from '@/lib/constants'
import { useApiResource } from '@/hooks/useApiResource'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { AdminListSkeleton } from '@/components/admin/shared/AdminListSkeleton'
import type { AdminOrdersResponse } from '@/lib/types/admin'

export default function AdminOrdersPage() {
  const t = useT()
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const queryString = statusFilter !== 'all' ? `?status=${statusFilter}&limit=50` : '?limit=50'
  const { data, loading } = useApiResource<AdminOrdersResponse>(`/api/admin/orders${queryString}`)

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        title={t.admin.orders}
        actions={
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
        }
      />

      {loading ? <AdminListSkeleton rows={6} /> : <OrdersTable orders={data?.orders ?? []} />}

      {data && (
        <p className="text-xs text-muted-foreground">
          Showing {data.orders.length} of {data.total} orders
        </p>
      )}
    </div>
  )
}
