'use client'

import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/Provider'
import type { VariantSelectorProps } from '@/lib/types/product'

export function VariantSelector({
  variants,
  selectedVariantId,
  onSelect,
  className,
}: VariantSelectorProps) {
  const t = useT()
  if (variants.length === 0) return null

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <p className="text-sm font-medium text-foreground">{t.store.selectVariant}</p>
      <div className="flex flex-wrap gap-2">
        {variants.map((variant) => {
          const isSelected = variant.id === selectedVariantId
          return (
            <button
              key={variant.id}
              type="button"
              onClick={() => onSelect(variant.id)}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                isSelected
                  ? 'border-primary ring-2 ring-primary ring-offset-1 font-medium'
                  : 'border-border hover:border-foreground/40',
              )}
              aria-pressed={isSelected}
            >
              {variant.colorHex && (
                <span
                  className="size-3.5 rounded-full border border-foreground/10 flex-none"
                  style={{ backgroundColor: variant.colorHex }}
                  aria-hidden="true"
                />
              )}
              <span>{variant.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
