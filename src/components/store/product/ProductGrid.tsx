import { ProductCard } from '@/components/store/product/ProductCard'
import { staggerDelay } from '@/lib/styles'
import type { ProductGridProps } from '@/lib/types/product'

// Cards visible above the fold on the narrowest viewport (2-col grid).
// Prioritising the first 4 covers the initial 2×2 block without over-fetching.
const PRIORITY_CARD_COUNT = 4

export function ProductGrid({ items }: ProductGridProps) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item, index) => (
        <ProductCard
          key={item.product.id}
          product={item.product}
          variants={item.variants}
          sizes={item.variants.flatMap((v) => v.sizes)}
          images={item.variants.flatMap((v) => v.images)}
          // pg-enter triggers CSS @starting-style entrance (gated on prefers-reduced-motion)
          className="pg-enter"
          style={{ transitionDelay: staggerDelay(index) }}
          // Eagerly load the first above-the-fold cards to improve LCP.
          priority={index < PRIORITY_CARD_COUNT}
        />
      ))}
    </div>
  )
}
