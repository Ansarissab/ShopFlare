import { ProductCard } from '@/components/store/product/ProductCard'
import type { ProductWithVariants } from '@/lib/types/product'

interface ProductGridProps {
  items: ProductWithVariants[]
  storeConfig?: { flatRateCents: number; thresholdCents: number }
}

// Cap stagger delay so the last card in a long list doesn't wait forever.
const MAX_STAGGER_MS = 480

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
          style={{ transitionDelay: `${Math.min(index * 60, MAX_STAGGER_MS)}ms` }}
          // Eagerly load the first above-the-fold cards to improve LCP.
          priority={index < PRIORITY_CARD_COUNT}
        />
      ))}
    </div>
  )
}
