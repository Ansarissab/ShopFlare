import { ProductCard } from '@/components/store/product/ProductCard'
import { staggerDelay } from '@/lib/styles'
import type { ProductGridProps } from '@/lib/types/product'

// Only the very first card is the LCP element on mobile — preloading more than one
// hi-priority image saturates mobile 4G bandwidth and *delays* the LCP image itself.
// One fetchpriority=high preload is the correct fix; the rest load lazily.
const PRIORITY_CARD_COUNT = 1

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
