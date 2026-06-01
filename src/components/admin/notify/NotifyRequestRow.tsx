'use client'

import { Badge } from '@/components/ui/badge'
import { en } from '@/lib/i18n/en'
import type { NotifyRequestRowProps } from '@/lib/types/store'

export function NotifyRequestRow({ request }: NotifyRequestRowProps) {
  const { productName, variantLabel, size, waiting, lastRequestedAt, inStock } = request

  const formattedDate = (() => {
    try {
      return new Date(lastRequestedAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    } catch {
      return lastRequestedAt
    }
  })()

  return (
    <div className="flex items-center justify-between rounded-md border px-4 py-3 text-sm">
      {/* Left: product / variant / size info */}
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="font-medium truncate">{productName}</span>
        <span className="text-muted-foreground truncate">
          {variantLabel} — {en.admin.notifySize}: {size}
        </span>
      </div>

      {/* Right: metadata */}
      <div className="flex items-center gap-4 shrink-0 ml-4">
        {/* waiting count */}
        <span className="text-muted-foreground text-xs">
          {en.admin.notifyRequestsFor.replace('{count}', String(waiting))}
        </span>

        {/* in-stock badge */}
        <Badge variant={inStock ? 'default' : 'secondary'}>
          {inStock ? en.admin.notifyInStock : en.admin.notifyOutOfStock}
        </Badge>

        {/* last requested date */}
        <span className="text-muted-foreground text-xs whitespace-nowrap">
          {en.admin.notifyRequestedAt}: {formattedDate}
        </span>
      </div>
    </div>
  )
}
