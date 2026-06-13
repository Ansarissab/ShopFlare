'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useCart, useCartItemCount } from '@/hooks/useCart'
import { useStoreConfig } from '@/hooks/useStoreConfig'
import { useApiResource } from '@/hooks/useApiResource'
import { CartSheet } from '@/components/store/cart/CartSheet'
import { CategoryNav } from '@/components/store/categories/CategoryNav'
import { layout } from '@/lib/styles'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/Provider'
import { catalogHref } from '@/lib/nav'
import type { CategoryNode } from '@/lib/types/category'

export function StorefrontHeader() {
  const t = useT()
  const { openCart } = useCart()
  const itemCount = useCartItemCount()
  const { config } = useStoreConfig()
  const { data: catData } = useApiResource<{ categories: CategoryNode[] }>('/api/categories')

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b bg-background">
        <div className={cn(layout.bar, 'h-16 justify-between')}>
          {/* Store name */}
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight text-foreground hover:opacity-80 transition-opacity"
          >
            {config?.logoUrl ? (
              <span className="relative block h-6 w-24 sm:h-8 sm:w-32">
                <Image
                  src={config.logoUrl}
                  alt={config.storeName ?? 'Store logo'}
                  fill
                  priority
                  sizes="128px"
                  className="object-contain object-left"
                  unoptimized
                />
              </span>
            ) : (
              (config?.storeName ?? 'ShopFlare')
            )}
          </Link>

          {/* Category nav */}
          <CategoryNav categories={catData?.categories ?? []} />

          {/* Shop link — only shown when landing page is enabled so / is the marketing page */}
          {config?.landingEnabled && (
            <Link
              href={catalogHref(true)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
            >
              {t.store.shopNav}
            </Link>
          )}

          {/* Track Order link */}
          <Link
            href="/track"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
          >
            {t.store.trackOrder}
          </Link>

          {/* Cart button */}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open cart"
            className="relative"
            onClick={openCart}
          >
            <ShoppingCart className="h-5 w-5" />
            {itemCount > 0 && (
              <Badge className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full p-0 text-[10px]">
                {itemCount > 99 ? '99+' : itemCount}
              </Badge>
            )}
          </Button>
        </div>
      </header>

      {/* CartSheet wired with live shipping config */}
      <CartSheet
        flatRateCents={config?.flatShippingRateCents ?? 0}
        thresholdCents={config?.freeShippingThresholdCents ?? 0}
      />
    </>
  )
}
