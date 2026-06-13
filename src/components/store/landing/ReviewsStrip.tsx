'use client'

import { ReviewStars } from '@/components/store/product/ReviewStars'
import { useApiResource } from '@/hooks/useApiResource'
import { useT } from '@/lib/i18n/Provider'
import { formatDate } from '@/lib/utils/index'
import type { ReviewsStripProps } from '@/lib/types'

interface StoreReviewsResponse {
  reviews: Array<{
    id: string
    customerName: string
    rating: number
    body: string | null
    createdAt: string
  }>
}

export function ReviewsStrip({ section }: ReviewsStripProps) {
  const t = useT()
  const heading = section.heading || t.store.reviewsHeading
  const { data, loading } = useApiResource<StoreReviewsResponse>('/api/reviews/store')

  const reviews = data?.reviews ?? []
  if (!loading && reviews.length === 0) return null

  return (
    <section className="bg-muted/40 py-16" aria-label={heading}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="mb-8 text-3xl font-bold">{heading}</h2>
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.map((review) => (
              <li
                key={review.id}
                className="rounded-xl bg-background p-6 shadow-sm flex flex-col gap-2"
              >
                <ReviewStars rating={review.rating} />
                {review.body && (
                  <p className="text-sm text-foreground/80 leading-relaxed line-clamp-4">
                    {review.body}
                  </p>
                )}
                <div className="mt-auto flex items-center justify-between pt-2">
                  <span className="text-sm font-medium">{review.customerName}</span>
                  <time dateTime={review.createdAt} className="text-xs text-muted-foreground">
                    {formatDate(review.createdAt)}
                  </time>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
