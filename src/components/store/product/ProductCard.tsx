import Link from 'next/link'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatPrice, getPriceRange } from '@/lib/utils/index'
import { prefetch } from '@/lib/api'
import { en } from '@/lib/i18n/en'
import type { ProductCardProps } from '@/lib/types/product'

export function ProductCard({
  product,
  variants,
  sizes,
  images,
  isNew,
  className,
}: ProductCardProps) {
  const { minPrice, maxPrice } = getPriceRange(sizes)
  // activeSizes used to show out-of-stock message
  const activeSizes = sizes.filter((s) => s.active && s.stock !== 0)

  // First image (lowest sortOrder across all variants)
  const firstImage = images
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)[0]

  // Variant color dots (up to 5)
  const colorVariants = variants.filter((v) => v.colorHex).slice(0, 5)

  return (
    <Link
      href={`/product/${product.id}`}
      className="group block outline-none"
      onMouseEnter={() => prefetch(`/api/products/${product.id}`)}
      onFocus={() => prefetch(`/api/products/${product.id}`)}
    >
      <Card
        className={cn(
          'overflow-hidden transition-shadow hover:shadow-md focus-within:ring-2 focus-within:ring-ring flex flex-col h-full',
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

        <CardContent className="flex flex-col gap-1.5 p-3 flex-1">
          {/* Name */}
          <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
            {product.name}
          </p>

          {/* Price range */}
          {minPrice !== null && (
            <p className="text-sm font-semibold text-primary">
              {formatPrice(minPrice)}
              {maxPrice !== null && maxPrice !== minPrice && '+'}
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
