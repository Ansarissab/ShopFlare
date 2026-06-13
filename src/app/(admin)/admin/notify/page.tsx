'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { NotifyRequestRow } from '@/components/admin/notify/NotifyRequestRow'
import { useApiResource } from '@/hooks/useApiResource'
import { useT } from '@/lib/i18n/Provider'
import type { NotifyRequestsResponse } from '@/lib/types/admin'

export default function AdminNotifyPage() {
  const t = useT()
  const { data, loading, error } = useApiResource<NotifyRequestsResponse>('/api/admin/notify')

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold tracking-tight">{t.admin.notifyRequests}</h1>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-md" />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{t.errors.networkError}</p>
      ) : !data || data.requests.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.admin.notifyNoRequests}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {data.requests.map((request) => (
            <NotifyRequestRow key={request.sizeOptionId} request={request} />
          ))}
        </div>
      )}
    </div>
  )
}
