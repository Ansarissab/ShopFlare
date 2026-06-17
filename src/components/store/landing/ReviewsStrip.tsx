'use client'

import { ReviewStars } from '@/components/store/product/ReviewStars'
import { useApiResource } from '@/hooks/useApiResource'
import { useReveal } from '@/hooks/useReveal'
import { useT } from '@/lib/i18n/Provider'
import { formatDate } from '@/lib/utils/index'
import type { ReviewsStripProps, StoreReviewsResponse } from '@/lib/types'

export function ReviewsStrip({ section }: ReviewsStripProps) {
  const t = useT()
  const heading = section.heading || t.store.reviewsHeading
  const { data, loading } = useApiResource<StoreReviewsResponse>('/api/reviews/store')
  const ref = useReveal<HTMLElement>()

  const reviews = data?.reviews ?? []
  if (!loading && reviews.length === 0) return null

  return (
    <section ref={ref} className="bg-muted/40 py-16" aria-label={heading}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="mb-8 text-3xl">{heading}</h2>
        {loading ? (
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {reviews.map((review) => (
              <li key={review.id} className="py-6 flex flex-col gap-2 sm:flex-row sm:gap-8">
                <div className="shrink-0 sm:w-40">
                  <ReviewStars rating={review.rating} />
                  <span className="mt-1 block text-sm font-medium">{review.customerName}</span>
                  <time dateTime={review.createdAt} className="text-xs text-muted-foreground">
                    {formatDate(review.createdAt)}
                  </time>
                </div>
                {review.body && (
                  <p className="line-clamp-4 text-sm text-muted-foreground leading-relaxed">
                    {review.body}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
