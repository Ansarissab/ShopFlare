'use client'

import { cn } from '@/lib/utils'
import { en } from '@/lib/i18n/en'
import type { CategoryFilterProps } from '@/lib/types/category'

export function CategoryFilter({ categories, activeSlug, onChange }: CategoryFilterProps) {
  if (categories.length === 0) return null

  return (
    <div className="w-full overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
      <div className="flex items-center gap-2 pb-1 min-w-max">
        {/* All Products chip */}
        <button
          type="button"
          onClick={() => onChange(null)}
          className={cn(
            'inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium transition-colors whitespace-nowrap',
            activeSlug === null
              ? 'bg-primary text-primary-foreground'
              : 'border border-border text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          {en.store.allProducts}
        </button>

        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => onChange(cat.slug)}
            className={cn(
              'inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium transition-colors whitespace-nowrap',
              activeSlug === cat.slug
                ? 'bg-primary text-primary-foreground'
                : 'border border-border text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {cat.name}
          </button>
        ))}
      </div>
    </div>
  )
}
