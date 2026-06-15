'use client'

import { Badge } from '@/components/ui/badge'
import { useT } from '@/lib/i18n/Provider'
import { layout } from '@/lib/styles'
import { cn } from '@/lib/utils'
import type { NotifyRequestRowProps } from '@/lib/types/admin'
import { formatDate } from '@/lib/utils/index'

export function NotifyRequestRow({ request, active }: NotifyRequestRowProps) {
  const t = useT()
  const { productName, variantLabel, size, waiting, lastRequestedAt, inStock } = request

  const formattedDate = formatDate(
    lastRequestedAt,
    { year: 'numeric', month: 'short', day: 'numeric' },
    undefined,
  )

  return (
    <div
      className={cn(
        layout.mobileStack,
        'rounded-md border px-4 py-3 text-sm',
        active && 'bg-muted ring-1 ring-inset ring-ring',
      )}
    >
      {/* Left: product / variant / size info */}
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="font-medium truncate">{productName}</span>
        <span className="text-muted-foreground truncate">
          {variantLabel} — {t.admin.notifySize}: {size}
        </span>
      </div>

      {/* Right: metadata */}
      <div className="flex items-center gap-2 sm:gap-4 sm:ml-4 sm:shrink-0">
        {/* waiting count */}
        <span className="text-muted-foreground text-xs">
          {t.admin.notifyRequestsFor.replace('{count}', String(waiting))}
        </span>

        {/* in-stock badge */}
        <Badge variant={inStock ? 'default' : 'secondary'}>
          {inStock ? t.admin.notifyInStock : t.admin.notifyOutOfStock}
        </Badge>

        {/* last requested date */}
        <span className="text-muted-foreground text-xs whitespace-nowrap">
          {t.admin.notifyRequestedAt}: {formattedDate}
        </span>
      </div>
    </div>
  )
}
