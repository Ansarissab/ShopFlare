'use client'

import { Progress } from '@/components/ui/progress'
import { useT } from '@/lib/i18n/Provider'
import { formatPrice } from '@/lib/utils/index'
import { cn } from '@/lib/utils'
import type { FreeShippingBarProps } from '@/lib/types/cart'

export function FreeShippingBar({ subtotalCents, thresholdCents }: FreeShippingBarProps) {
  const t = useT()
  if (thresholdCents === 0) return null

  const qualified = subtotalCents >= thresholdCents
  const progressValue = Math.min(Math.round((subtotalCents / thresholdCents) * 100), 100)

  if (qualified) {
    return (
      <div
        className={cn(
          'rounded-md bg-success/10 px-3 py-2 text-center text-xs font-medium text-success',
        )}
      >
        {t.store.freeShippingQualified}
      </div>
    )
  }

  const remaining = thresholdCents - subtotalCents
  const message = t.store.freeShippingProgress.replace('{amount}', formatPrice(remaining))

  return (
    <div className="space-y-1.5 px-1">
      <p className="text-center text-xs text-muted-foreground">{message}</p>
      <Progress value={progressValue} aria-label={t.store.freeShipping} />
    </div>
  )
}
