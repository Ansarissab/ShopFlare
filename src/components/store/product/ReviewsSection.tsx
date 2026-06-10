'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ReviewStars } from '@/components/store/product/ReviewStars'
import { ReviewForm } from '@/components/store/product/ReviewForm'
import { useApiResource } from '@/hooks/useApiResource'
import { en } from '@/lib/i18n/en'
import type { ReviewsSectionProps, ProductReviewsResponse } from '@/lib/types/product'
import { formatDate } from '@/lib/utils/index'

export function ReviewsSection({
  productId,
  productName,
  reviewsEnabled = true,
  className,
}: ReviewsSectionProps) {
  const [showForm, setShowForm] = useState(false)
  const { data, loading, error } = useApiResource<ProductReviewsResponse>(
    reviewsEnabled ? `/api/reviews/product/${productId}` : null,
  )

  function handleSubmitted() {
    setShowForm(false)
  }

  if (!reviewsEnabled) return null

  return (
    <section aria-labelledby="reviews-heading" className={className}>
      <div className="flex items-center justify-between mb-4">
        <h2 id="reviews-heading" className="text-xl font-semibold tracking-tight">
          {en.reviews.sectionTitle}
        </h2>
        {!showForm && (
          <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
            {en.reviews.writeReview}
          </Button>
        )}
      </div>

      {showForm && (
        <>
          <ReviewForm
            productId={productId}
            productName={productName}
            onSubmitted={handleSubmitted}
          />
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => setShowForm(false)}>
            {en.reviews.cancel}
          </Button>
          <Separator className="my-6" />
        </>
      )}

      {loading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-md" />
          ))}
        </div>
      )}

      {!loading && error && <p className="text-sm text-destructive">{en.errors.networkError}</p>}

      {!loading && !error && data && (
        <>
          {data.count > 0 ? (
            <>
              {/* Aggregate */}
              <div className="flex items-center gap-3 mb-4">
                <ReviewStars rating={Math.round(data.average)} />
                <span className="text-sm font-medium">
                  {en.reviews.averageOf.replace('{average}', String(data.average))}
                </span>
                <span className="text-sm text-muted-foreground">
                  {en.reviews.basedOn.replace('{count}', String(data.count))}
                </span>
              </div>

              <Separator className="mb-4" />

              {/* Review list */}
              <ul className="flex flex-col gap-5">
                {data.reviews.map((review) => (
                  <li key={review.id} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{review.customerName}</span>
                        <span className="text-xs text-muted-foreground">
                          {en.reviews.verifiedPurchase}
                        </span>
                      </div>
                      <time dateTime={review.createdAt} className="text-xs text-muted-foreground">
                        {formatDate(review.createdAt)}
                      </time>
                    </div>
                    <ReviewStars rating={review.rating} />
                    {review.body && (
                      <p className="text-sm text-foreground/80 leading-relaxed">{review.body}</p>
                    )}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-muted-foreground py-4">{en.reviews.noReviews}</p>
          )}
        </>
      )}
    </section>
  )
}
