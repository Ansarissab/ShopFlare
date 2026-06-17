'use client'

import { cn } from '@/lib/utils'
import { formatPrice } from '@/lib/utils/index'
import { useT } from '@/lib/i18n/Provider'
import { price as priceStyle } from '@/lib/styles'
import { LOW_STOCK_THRESHOLD } from '@/lib/constants'
import { Badge } from '@/components/ui/badge'
import type { SizePickerProps } from '@/lib/types/product'

export function SizePicker({ sizes, selectedSizeId, onSelect, className }: SizePickerProps) {
  const t = useT()
  if (sizes.length === 0) return null

  const activeSizes = sizes.filter((s) => s.active)

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <p className="text-sm font-medium text-foreground">{t.store.selectSize}</p>
      <div className="flex flex-wrap gap-2">
        {activeSizes.map((size) => {
          const isOOS = size.stock === 0
          const isLow = size.stock > 0 && size.stock <= LOW_STOCK_THRESHOLD
          const isSelected = size.id === selectedSizeId

          return (
            <div key={size.id} className="relative flex flex-col items-center gap-1">
              <button
                type="button"
                disabled={isOOS}
                onClick={() => !isOOS && onSelect(size.id)}
                className={cn(
                  'flex min-w-[4rem] flex-col items-center rounded-lg border px-3 py-2 text-sm transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                  isSelected
                    ? 'border-primary bg-primary text-primary-foreground ring-2 ring-primary ring-offset-1'
                    : 'border-border hover:border-foreground/40',
                  isOOS && 'cursor-not-allowed opacity-40',
                )}
                aria-pressed={isSelected}
                aria-disabled={isOOS}
              >
                <span className={cn('font-medium', isOOS && 'line-through')}>{size.size}</span>
                <span
                  className={cn(
                    'text-xs',
                    priceStyle.mono,
                    isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground',
                  )}
                >
                  {formatPrice(size.priceCents)}
                </span>
              </button>

              {isOOS && (
                <Badge variant="outline" className="text-xs px-1.5 py-0 h-4 pointer-events-none">
                  {t.store.outOfStock}
                </Badge>
              )}

              {isLow && (
                <Badge
                  variant="destructive"
                  className="text-xs px-1.5 py-0 h-4 pointer-events-none"
                >
                  {t.store.lowStock.replace('{count}', String(size.stock))}
                </Badge>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
