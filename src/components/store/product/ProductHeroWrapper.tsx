'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ProductHero } from '@/components/store/product/ProductHero'
import { useCart } from '@/hooks/useCart'
import { useStoreConfig } from '@/hooks/useStoreConfig'
import { buildWhatsAppOrderUrl } from '@/lib/whatsapp'
import { buildProductMaps } from '@/lib/utils/index'
import { DEFAULT_CURRENCY } from '@/lib/constants'
import { isFeatureEnabled } from '@/lib/features'
import { en } from '@/lib/i18n/en'
import { apiPost } from '@/lib/api'
import type { CartItem } from '@/hooks/useCart'
import type { SizeOption, ProductHeroWrapperProps } from '@/lib/types/product'

export function ProductHeroWrapper({ item }: ProductHeroWrapperProps) {
  const { addItem, openCart } = useCart()
  const { config } = useStoreConfig()
  const router = useRouter()
  const [isAddingToCart, setIsAddingToCart] = useState(false)

  const { sizesByVariant, imagesByVariant } = buildProductMaps(item.variants)

  // ── Local helper: build a CartItem from a SizeOption ───────────────────────
  const buildCartItem = useCallback(
    (size: SizeOption): CartItem => {
      const variant = item.variants.find((v) =>
        v.sizes.some((s: SizeOption) => s.id === size.id),
      )
      return {
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
      }
    },
    [item],
  )

  const handleAddToCart = useCallback(
    (size: SizeOption) => {
      setIsAddingToCart(true)
      addItem(buildCartItem(size))
      openCart()
      setIsAddingToCart(false)
    },
    [buildCartItem, addItem, openCart],
  )

  const handleBuyNow = useCallback(
    async (size: SizeOption) => {
      if (size.stripePriceId) {
        try {
          const { url } = await apiPost<{ url: string }>('/api/stripe/checkout-session', {
            items: [{ stripePriceId: size.stripePriceId, quantity: 1 }],
          })
          router.push(url)
          return
        } catch {
          toast.error(en.errors.orderFailed)
          // fall through to cart fallback
        }
      }
      addItem(buildCartItem(size))
      router.push('/checkout')
    },
    [buildCartItem, addItem, router],
  )

  const handleWhatsApp = useCallback(
    (size: SizeOption) => {
      if (!config?.whatsappNumber) {
        toast.error(en.errors.networkError)
        return
      }
      const variant = item.variants.find((v) =>
        v.sizes.some((s: SizeOption) => s.id === size.id),
      )
      const url = buildWhatsAppOrderUrl({
        phoneNumber: config.whatsappNumber,
        productName: item.product.name,
        variantLabel: variant?.label ?? '',
        size: size.size,
        sku: size.sku ?? undefined,
        priceCents: size.priceCents,
        currency: config.currency ?? DEFAULT_CURRENCY,
        quantity: 1,
      })
      window.open(url, '_blank', 'noopener,noreferrer')
    },
    [config, item],
  )

  const handleCOD = useCallback(
    (size: SizeOption) => {
      addItem(buildCartItem(size))
      router.push('/checkout')
    },
    [buildCartItem, addItem, router],
  )

  const showWhatsApp = isFeatureEnabled(config, 'whatsappEnabled') && !!config?.whatsappNumber

  return (
    <ProductHero
      product={item.product}
      variants={item.variants}
      sizesByVariant={sizesByVariant}
      imagesByVariant={imagesByVariant}
      currency={config?.currency ?? DEFAULT_CURRENCY}
      isAddingToCart={isAddingToCart}
      showWhatsApp={showWhatsApp}
      onAddToCart={handleAddToCart}
      onBuyNow={handleBuyNow}
      onWhatsApp={handleWhatsApp}
      onCOD={handleCOD}
    />
  )
}
