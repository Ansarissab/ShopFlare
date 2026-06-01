'use client'

import { Progress } from '@/components/ui/progress'
import { en } from '@/lib/i18n/en'
import { formatPrice } from '@/lib/utils/index'
import { cn } from '@/lib/utils'

type Props = {
  subtotalCents: number
  thresholdCents: number
  flatRateCents: number
}

export function FreeShippingBar({ subtotalCents, thresholdCents }: Props) {
  if (thresholdCents === 0) return null

  const qualified = subtotalCents >= thresholdCents
  const progressValue = Math.min(
    Math.round((subtotalCents / thresholdCents) * 100),
    100
  )

  if (qualified) {
    return (
      <div
        className={cn(
          'rounded-md bg-green-500/10 px-3 py-2 text-center text-xs font-medium text-green-700 dark:text-green-400'
        )}
      >
        {en.store.freeShipping}!
      </div>
    )
  }

  const remaining = thresholdCents - subtotalCents
  const message = en.store.freeShippingProgress.replace(
    '{amount}',
    formatPrice(remaining)
  )

  return (
    <div className="space-y-1.5 px-1">
      <p className="text-center text-xs text-muted-foreground">{message}</p>
      <Progress value={progressValue} aria-label={en.store.freeShipping} />
    </div>
  )
}
