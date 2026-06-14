import { ProductCard } from '@/components/store/product/ProductCard'
import type { FeaturedProductsStripProps } from '@/lib/types'
import type { ProductWithVariants } from '@/lib/types/product'

export function FeaturedProductsStrip({ section, products, t }: FeaturedProductsStripProps) {
  const heading = section.heading || t.store.featuredProductsHeading

  if (products.length === 0) return null

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8" aria-label={heading}>
      <h2 className="mb-8 text-3xl font-bold">{heading}</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {products.map((item: ProductWithVariants, index: number) => (
          <ProductCard
            key={item.product.id}
            product={item.product}
            variants={item.variants}
            sizes={item.variants.flatMap((v) => v.sizes)}
            images={item.variants.flatMap((v) => v.images)}
            priority={index < 4}
          />
        ))}
      </div>
    </section>
  )
}
