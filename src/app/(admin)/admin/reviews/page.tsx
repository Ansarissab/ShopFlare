'use client'

import { useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { AdminReviewRow } from '@/components/admin/reviews/AdminReviewRow'
import { useApiResource } from '@/hooks/useApiResource'
import { en } from '@/lib/i18n/en'
import type { AdminReviewsResponse, ReviewTableProps } from '@/lib/types/store'

// ─── Inner table ──────────────────────────────────────────────────────────────

function ReviewTable({ reviews, onChanged }: ReviewTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            {[
              en.admin.reviewStatus,
              en.admin.reviewProduct,
              en.admin.reviewCustomer,
              en.admin.reviewRating,
              en.reviews.yourReview,
              en.admin.reviewDate,
              '',
            ].map((h, i) => (
              <th
                key={i}
                className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {reviews.map((review) => (
            <AdminReviewRow key={review.id} review={review} onChanged={onChanged} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminReviewsPage() {
  // Bumping this counter forces useApiResource to re-fetch by changing the path
  const [rev, setRev] = useState(0)
  const path = `/api/admin/reviews${rev > 0 ? `?_r=${rev}` : ''}`
  const { data, loading } = useApiResource<AdminReviewsResponse>(path)

  function handleChanged() {
    setRev((n) => n + 1)
  }

  const pending = data?.reviews.filter((r) => !r.approved) ?? []
  const approved = data?.reviews.filter((r) => r.approved) ?? []

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">{en.admin.reviewModeration}</h1>

      {loading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      )}

      {!loading && data?.reviews.length === 0 && (
        <p className="text-sm text-muted-foreground">{en.admin.noReviewsToModerate}</p>
      )}

      {!loading && data && (
        <>
          {pending.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-base font-semibold">{en.admin.pendingReviews}</h2>
              <ReviewTable reviews={pending} onChanged={handleChanged} />
            </div>
          )}

          {approved.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-base font-semibold">{en.admin.approvedReviews}</h2>
              <ReviewTable reviews={approved} onChanged={handleChanged} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
