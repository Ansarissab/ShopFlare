// Shared building blocks for landing templates — style-light primitives composed per template.

import { ProductGrid } from '@/components/store/product/ProductGrid'
import type { ProductWithVariants } from '@/lib/types/product'

interface FeaturedGridProps {
  products: ProductWithVariants[]
  heading?: string
  headingClassName?: string
  wrapperClassName?: string
}

/**
 * Wraps the existing ProductGrid for the featured-products section.
 * All landing templates use this so featured products render identically.
 * Heading and wrapper styling come from the caller via className props.
 */
export function FeaturedGrid({
  products,
  heading,
  headingClassName,
  wrapperClassName,
}: FeaturedGridProps) {
  if (products.length === 0) return null

  return (
    <div className={wrapperClassName}>
      {heading && <h2 className={headingClassName}>{heading}</h2>}
      <ProductGrid items={products} />
    </div>
  )
}
