'use client'

import { NotifyRequestRow } from '@/components/admin/notify/NotifyRequestRow'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { AdminListSkeleton } from '@/components/admin/shared/AdminListSkeleton'
import { useApiResource } from '@/hooks/useApiResource'
import { useT } from '@/lib/i18n/Provider'
import { useListNavigation } from '@/hooks/useListNavigation'
import { useRegisterListNav } from '@/components/admin/shared/ListNavContext'
import type { NotifyRequestsResponse } from '@/lib/types/admin'

export default function AdminNotifyPage() {
  const t = useT()
  const { data, loading, error } = useApiResource<NotifyRequestsResponse>('/api/admin/notify')

  const requests = data?.requests ?? []
  const { next, prev, open, isActive } = useListNavigation({
    items: requests,
    onOpen: () => {},
  })
  useRegisterListNav({ next, prev, open })

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader title={t.admin.notifyRequests} />

      {loading ? (
        <AdminListSkeleton rows={5} itemClassName="h-14 w-full rounded-md" />
      ) : error ? (
        <p className="text-sm text-destructive">{t.errors.networkError}</p>
      ) : !data || data.requests.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.admin.notifyNoRequests}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {requests.map((request, index) => (
            <NotifyRequestRow
              key={request.sizeOptionId}
              request={request}
              active={isActive(index)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
