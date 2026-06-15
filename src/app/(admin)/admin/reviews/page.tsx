'use client'

import { useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { AdminReviewRow } from '@/components/admin/reviews/AdminReviewRow'
import { useApiResource } from '@/hooks/useApiResource'
import { useT } from '@/lib/i18n/Provider'
import { useListNavigation } from '@/hooks/useListNavigation'
import { useRegisterListNav } from '@/components/admin/shared/ListNavContext'
import type { AdminReviewsResponse, ReviewTableProps } from '@/lib/types/admin'

// ─── Inner table ──────────────────────────────────────────────────────────────

function ReviewTable({ reviews, onChanged, baseIndex = 0, isActive }: ReviewTableProps) {
  const t = useT()
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">
              {t.admin.reviewStatus}
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">
              {t.admin.reviewProduct}
            </th>
            <th className="hidden md:table-cell px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">
              {t.admin.reviewCustomer}
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">
              {t.admin.reviewRating}
            </th>
            <th className="hidden sm:table-cell px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">
              {t.reviews.yourReview}
            </th>
            <th className="hidden md:table-cell px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">
              {t.admin.reviewDate}
            </th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {reviews.map((review, i) => (
            <AdminReviewRow
              key={review.id}
              review={review}
              onChanged={onChanged}
              active={isActive?.(baseIndex + i)}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminReviewsPage() {
  const t = useT()
  // Bumping this counter forces useApiResource to re-fetch by changing the path
  const [rev, setRev] = useState(0)
  const path = `/api/admin/reviews${rev > 0 ? `?_r=${rev}` : ''}`
  const { data, loading } = useApiResource<AdminReviewsResponse>(path)

  function handleChanged() {
    setRev((n) => n + 1)
  }

  const pending = data?.reviews.filter((r) => !r.approved) ?? []
  const approved = data?.reviews.filter((r) => r.approved) ?? []

  // Nav over all reviews: pending first, then approved (mirrors render order)
  const allReviews = [...pending, ...approved]
  const { next, prev, open, isActive } = useListNavigation({
    items: allReviews,
    onOpen: () => {},
  })
  useRegisterListNav({ next, prev, open })

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={t.admin.reviewModeration} />

      {loading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      )}

      {!loading && data?.reviews.length === 0 && (
        <p className="text-sm text-muted-foreground">{t.admin.noReviewsToModerate}</p>
      )}

      {!loading && data && (
        <>
          {pending.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-base font-semibold">{t.admin.pendingReviews}</h2>
              <ReviewTable
                reviews={pending}
                onChanged={handleChanged}
                baseIndex={0}
                isActive={isActive}
              />
            </div>
          )}

          {approved.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-base font-semibold">{t.admin.approvedReviews}</h2>
              <ReviewTable
                reviews={approved}
                onChanged={handleChanged}
                baseIndex={pending.length}
                isActive={isActive}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
