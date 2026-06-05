import { ProductCard } from '@/components/store/product/ProductCard'
import type { ProductWithVariants } from '@/lib/types/product'

interface ProductGridProps {
  items: ProductWithVariants[]
  storeConfig?: { flatRateCents: number; thresholdCents: number }
}

export function ProductGrid({ items }: ProductGridProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => (
        <ProductCard
          key={item.product.id}
          product={item.product}
          variants={item.variants}
          sizes={item.variants.flatMap((v) => v.sizes)}
          images={item.variants.flatMap((v) => v.images)}
        />
      ))}
    </div>
  )
}
