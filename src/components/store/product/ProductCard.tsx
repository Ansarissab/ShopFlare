'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatPrice, getPriceRange } from '@/lib/utils/index'
import { prefetch } from '@/lib/api'
import { price as priceStyle } from '@/lib/styles'
import { useViewportPrefetch } from '@/hooks/useViewportPrefetch'
import { useCart } from '@/hooks/useCart'
import { useT } from '@/lib/i18n/Provider'
import type { ProductCardProps } from '@/lib/types/product'

export function ProductCard({
  product,
  variants,
  sizes,
  images,
  isNew,
  className,
  style,
  priority = false,
  eager = false,
}: ProductCardProps) {
  const t = useT()
  const viewportRef = useViewportPrefetch<HTMLAnchorElement>(`/api/products/${product.id}`)
  const { addItem, openCart } = useCart()
  const { minPrice, maxPrice } = getPriceRange(sizes)
  // activeSizes: in-stock and active
  const activeSizes = sizes.filter((s) => s.active && s.stock !== 0)

  // First image (lowest sortOrder across all variants)
  const firstImage = images.slice().sort((a, b) => a.sortOrder - b.sortOrder)[0]

  // Variant color dots (up to 5)
  const colorVariants = variants.filter((v) => v.colorHex).slice(0, 5)
  const extraColorCount = variants.filter((v) => v.colorHex).length - 5

  // Quick-add: only works when exactly one active size is available (no selection needed)
  const canQuickAdd = activeSizes.length === 1

  function handleQuickAdd(e: React.MouseEvent) {
    if (!canQuickAdd) return
    e.preventDefault()
    e.stopPropagation()
    const size = activeSizes[0]
    const variant = variants.find((v) => v.id === size.variantId) ?? variants[0]
    addItem({
      sizeOptionId: size.id,
      productId: product.id,
      variantId: variant?.id ?? '',
      productName: product.name,
      variantLabel: variant?.label ?? '',
      size: size.size,
      sku: size.sku ?? undefined,
      priceCents: size.priceCents,
      stripePriceId: size.stripePriceId ?? undefined,
      imageUrl: firstImage?.url ?? '',
      quantity: 1,
    })
    openCart()
  }

  return (
    <Link
      ref={viewportRef}
      href={`/product/${product.id}`}
      prefetch={false}
      className={cn(
        'group block outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-[3px]',
        className,
      )}
      style={style}
      onMouseEnter={() => prefetch(`/api/products/${product.id}`)}
      onFocus={() => prefetch(`/api/products/${product.id}`)}
    >
      {/* Image frame — overflow-hidden clips the zoom transform */}
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[3px] bg-muted">
        {firstImage ? (
          <Image
            src={firstImage.url}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            priority={priority}
            // priority → eager + preload + high (Next handles it). Otherwise mark the rest of
            // the above-the-fold cards eager so the mobile LCP image is never lazy-deferred.
            loading={priority ? undefined : eager ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            className={cn(
              'object-cover',
              // Zoom on hover — transform only, never "all". Gated by prefers-reduced-motion
              // via the Tailwind motion-safe: variant.
              'motion-safe:transition-[transform,filter] motion-safe:duration-300 motion-safe:ease-out',
              'motion-safe:group-hover:scale-[1.03] motion-safe:group-hover:grayscale',
            )}
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <span className="text-muted-foreground text-xs">No image</span>
          </div>
        )}

        {isNew && <Badge className="absolute start-2 top-2">{t.product.new}</Badge>}

        {/* Quick-add affordance — revealed on hover, only for single-size products.
            Multi-size products skip this overlay; the whole card is a <Link> to the PDP
            where the shopper picks a size. */}
        {canQuickAdd && (
          <div
            className={cn(
              'absolute inset-x-0 bottom-0',
              'motion-safe:opacity-0 motion-safe:translate-y-1',
              'motion-safe:transition-[opacity,transform] motion-safe:duration-200 motion-safe:ease-out',
              'motion-safe:group-hover:opacity-100 motion-safe:group-hover:translate-y-0',
              // Always visible when motion is reduced (no hidden affordances)
              'motion-reduce:opacity-100',
            )}
          >
            <button
              type="button"
              aria-label={`${t.store.quickAdd} — ${product.name}`}
              onClick={handleQuickAdd}
              className={cn(
                'w-full min-h-11 px-3 py-2.5',
                'text-xs font-medium tracking-wide',
                'bg-background/90 backdrop-blur-[2px]',
                'text-foreground border-t border-border/60',
                'transition-colors hover:bg-background cursor-pointer motion-safe:active:scale-95',
              )}
            >
              {t.store.quickAdd}
            </button>
          </div>
        )}
      </div>

      {/* Meta row: name + price on the same baseline */}
      <div className="mt-2.5 flex items-baseline justify-between gap-2 px-0.5">
        <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground min-w-0">
          {product.name}
        </p>

        {minPrice !== null && (
          <p className={cn('shrink-0 text-sm font-medium text-foreground', priceStyle.mono)}>
            {formatPrice(minPrice)}
            {maxPrice !== null && maxPrice !== minPrice && '+'}
          </p>
        )}
      </div>

      {/* Out of stock */}
      {activeSizes.length === 0 && (
        <p className="mt-1 px-0.5 text-xs text-muted-foreground">{t.store.outOfStock}</p>
      )}

      {/* Variant color dots */}
      {colorVariants.length > 0 && (
        <div className="mt-1.5 flex items-center gap-1 px-0.5">
          {colorVariants.map((v) => (
            <span
              key={v.id}
              className="size-3 rounded-full border border-foreground/10 flex-none"
              style={{ backgroundColor: v.colorHex! }}
              title={v.label}
            />
          ))}
          {extraColorCount > 0 && (
            <span className="text-xs text-muted-foreground">+{extraColorCount}</span>
          )}
        </div>
      )}
    </Link>
  )
}
