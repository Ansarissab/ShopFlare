'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ProductHero } from '@/components/store/product/ProductHero'
import { useCart } from '@/hooks/useCart'
import { useStoreConfig } from '@/hooks/useStoreConfig'
import { buildWhatsAppOrderUrl } from '@/lib/whatsapp'
import { buildProductMaps } from '@/lib/utils/index'
import { DEFAULT_CURRENCY } from '@/lib/constants'
import { isFeatureEnabled } from '@/lib/features'
import { useT } from '@/lib/i18n/Provider'
import { apiPost } from '@/lib/api'
import type { CartItem } from '@/hooks/useCart'
import type { SizeOption, ProductHeroWrapperProps } from '@/lib/types/product'

/** Duration the "Added" confirmation state is shown (ms). Must match DESIGN.md spec. */
const ADDED_DURATION_MS = 1500

export function ProductHeroWrapper({ item }: ProductHeroWrapperProps) {
  const t = useT()
  const { addItem, openCart } = useCart()
  const { config } = useStoreConfig()
  const router = useRouter()
  const [isAddingToCart, setIsAddingToCart] = useState(false)
  const [isAdded, setIsAdded] = useState(false)
  const addedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clean up the revert timer on unmount to avoid act() / setState-after-unmount warnings
  useEffect(() => {
    return () => {
      if (addedTimerRef.current !== null) clearTimeout(addedTimerRef.current)
    }
  }, [])

  const { sizesByVariant, imagesByVariant } = buildProductMaps(item.variants)

  // ── Local helper: build a CartItem from a SizeOption ───────────────────────
  const buildCartItem = useCallback(
    (size: SizeOption): CartItem => {
      const variant = item.variants.find((v) => v.sizes.some((s: SizeOption) => s.id === size.id))
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
      // Show confirmation state; clear any pending revert before setting a new one
      if (addedTimerRef.current !== null) clearTimeout(addedTimerRef.current)
      setIsAdded(true)
      addedTimerRef.current = setTimeout(() => {
        setIsAdded(false)
        addedTimerRef.current = null
      }, ADDED_DURATION_MS)
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
          toast.error(t.errors.orderFailed)
          // fall through to cart fallback
        }
      }
      addItem(buildCartItem(size))
      router.push('/checkout')
    },
    [buildCartItem, addItem, router, t],
  )

  const handleWhatsApp = useCallback(
    (size: SizeOption) => {
      if (!config?.whatsappNumber) {
        toast.error(t.errors.networkError)
        return
      }
      const variant = item.variants.find((v) => v.sizes.some((s: SizeOption) => s.id === size.id))
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
    [config, item, t],
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
      isAdded={isAdded}
      showWhatsApp={showWhatsApp}
      onAddToCart={handleAddToCart}
      onBuyNow={handleBuyNow}
      onWhatsApp={handleWhatsApp}
      onCOD={handleCOD}
    />
  )
}
