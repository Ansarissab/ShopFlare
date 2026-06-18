import { ProductCard } from '@/components/store/product/ProductCard'
import { staggerDelay } from '@/lib/styles'
import type { ProductGridProps } from '@/lib/types/product'

// Above-the-fold image loading, DERIVED from the grid layout below (not magic numbers) so it
// stays correct if the columns change. The densest above-the-fold case is mobile (`grid-cols-2`),
// which drives both counts:
//   - PRELOAD = exactly ONE image → fetchpriority=high + preload link. Only the single most-likely
//     LCP image gets the strongest hint. Preloading more — even the rest of the first row — makes
//     the hi-priority images starve each other on mobile 4G and DELAYS the true LCP. Proven:
//     dropping 4→1 preload took mobile PSI 79→84 (commit f49a7c4). Keep this at 1.
//   - EAGER = the mobile rows visible before scrolling → `loading="eager"` (NO preload). This is
//     the key mobile-LCP fix: the LCP element is often a card *below* the first one, and if it's
//     `loading="lazy"` it loads late and tanks LCP. Eager-loading the above-the-fold rows fixes
//     that without the preload contention of marking them all `priority`.
const MOBILE_COLS = 2 // grid-cols-2 — the densest layout, so it bounds the above-the-fold count
const ABOVE_FOLD_ROWS = 3 // ~rows of cards visible on a mobile viewport before scrolling
const PRELOAD_COUNT = 1 // ONE preload only — NOT MOBILE_COLS; competing preloads starve the LCP
const EAGER_COUNT = MOBILE_COLS * ABOVE_FOLD_ROWS // above-the-fold

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
          // First row preloaded (LCP); the rest of the above-the-fold loads eagerly (not lazy).
          priority={index < PRELOAD_COUNT}
          eager={index < EAGER_COUNT}
        />
      ))}
    </div>
  )
}
