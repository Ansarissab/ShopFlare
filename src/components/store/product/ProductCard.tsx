import Link from 'next/link'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatPrice } from '@/lib/utils/index'
import { en } from '@/lib/i18n/en'
import type { Product, Variant, SizeOption, ProductImage } from '@/lib/types/store'

interface ProductCardProps {
  product: Product
  variants: Variant[]
  sizes: SizeOption[]          // all sizes across all variants of this product
  images: ProductImage[]       // all images across all variants
  isNew?: boolean
  className?: string
}

export function ProductCard({
  product,
  variants,
  sizes,
  images,
  isNew,
  className,
}: ProductCardProps) {
  // Derive min price from active sizes with positive stock
  const activeSizes = sizes.filter((s) => s.active && s.stock !== 0)
  const prices = activeSizes.map((s) => s.priceCents)
  const minPrice = prices.length > 0 ? Math.min(...prices) : null

  // First image (lowest sortOrder across all variants)
  const firstImage = images
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)[0]

  // Variant color dots (up to 5)
  const colorVariants = variants.filter((v) => v.colorHex).slice(0, 5)

  return (
    <Link href={`/product/${product.id}`} className="group block outline-none">
      <Card
        className={cn(
          'overflow-hidden transition-shadow hover:shadow-md focus-within:ring-2 focus-within:ring-ring',
          className,
        )}
      >
        {/* Image */}
        <div className="relative aspect-square w-full overflow-hidden bg-muted">
          {firstImage ? (
            <Image
              src={firstImage.url}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex size-full items-center justify-center">
              <span className="text-muted-foreground text-xs">No image</span>
            </div>
          )}

          {isNew && (
            <Badge className="absolute left-2 top-2">
              {en.product.new}
            </Badge>
          )}
        </div>

        <CardContent className="flex flex-col gap-1.5 p-3">
          {/* Name */}
          <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
            {product.name}
          </p>

          {/* Price range */}
          {minPrice !== null && (
            <p className="text-sm font-semibold text-primary">
              {formatPrice(minPrice)}
              {prices.length > 1 && prices.some((p) => p !== minPrice) && '+'}
            </p>
          )}

          {activeSizes.length === 0 && (
            <p className="text-xs text-muted-foreground">{en.store.outOfStock}</p>
          )}

          {/* Variant color dots */}
          {colorVariants.length > 0 && (
            <div className="flex items-center gap-1 pt-0.5">
              {colorVariants.map((v) => (
                <span
                  key={v.id}
                  className="size-3 rounded-full border border-black/10 flex-none"
                  style={{ backgroundColor: v.colorHex! }}
                  title={v.label}
                />
              ))}
              {variants.filter((v) => v.colorHex).length > 5 && (
                <span className="text-xs text-muted-foreground">
                  +{variants.filter((v) => v.colorHex).length - 5}
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
