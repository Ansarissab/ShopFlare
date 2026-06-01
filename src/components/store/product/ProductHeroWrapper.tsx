'use client'

import { useState, useCallback } from 'react'
import { ProductHero } from '@/components/store/product/ProductHero'
import { useCart } from '@/hooks/useCart'
import { buildProductMaps } from '@/lib/utils/index'
import type { ProductWithVariants, SizeOption } from '@/lib/types/store'

interface Props {
  item: ProductWithVariants
}

export function ProductHeroWrapper({ item }: Props) {
  const { addItem, openCart } = useCart()
  const [isAddingToCart, setIsAddingToCart] = useState(false)

  const { sizesByVariant, imagesByVariant } = buildProductMaps(item.variants)

  const handleAddToCart = useCallback(
    (size: SizeOption) => {
      setIsAddingToCart(true)
      const variant = item.variants.find((v) => v.sizes.some((s: SizeOption) => s.id === size.id))
      addItem({
        sizeOptionId: size.id,
        productId: item.product.id,
        variantId: variant?.id ?? '',
        productName: item.product.name,
        variantLabel: variant?.label ?? '',
        size: size.size,
        sku: size.sku ?? undefined,
        priceCents: size.priceCents,
        stripePriceId: size.stripePriceId ?? undefined,
        imageUrl: variant?.images[0]?.url ?? '',
        quantity: 1,
      })
      openCart()
      setIsAddingToCart(false)
    },
    [item, addItem, openCart],
  )

  return (
    <ProductHero
      product={item.product}
      variants={item.variants}
      sizesByVariant={sizesByVariant}
      imagesByVariant={imagesByVariant}
      isAddingToCart={isAddingToCart}
      onAddToCart={handleAddToCart}
      onBuyNow={handleAddToCart}
      onWhatsApp={() => {}}
      onCOD={() => {}}
      onNotifyMe={() => {}}
    />
  )
}
