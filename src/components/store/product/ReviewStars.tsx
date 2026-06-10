'use client'

import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { en } from '@/lib/i18n/en'
import type { ReviewStarsProps } from '@/lib/types/product'

/**
 * ReviewStars — star rating display (read-only) or interactive input.
 * Interactive when `onChange` is provided; read-only otherwise.
 */
export function ReviewStars({ rating, onChange, className }: ReviewStarsProps) {
  const interactive = typeof onChange === 'function'

  return (
    <div
      className={cn('flex items-center gap-0.5', className)}
      role={interactive ? 'radiogroup' : 'img'}
      aria-label={
        interactive
          ? en.reviews.selectRating
          : en.reviews.starsAriaLabel.replace('{rating}', String(rating))
      }
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= rating
        return interactive ? (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            aria-label={(star === 1 ? en.reviews.starLabel : en.reviews.starLabelPlural).replace(
              '{count}',
              String(star),
            )}
            className="focus-visible:outline-none"
          >
            <Star
              className={cn(
                'size-5 transition-colors',
                filled
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'fill-none text-muted-foreground hover:text-yellow-400',
              )}
              aria-hidden
            />
          </button>
        ) : (
          <Star
            key={star}
            className={cn(
              'size-4',
              filled ? 'fill-yellow-400 text-yellow-400' : 'fill-none text-muted-foreground',
            )}
            aria-hidden
          />
        )
      })}
    </div>
  )
}
