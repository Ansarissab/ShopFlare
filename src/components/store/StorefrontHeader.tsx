'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ShoppingCart, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useCart, useCartItemCount } from '@/hooks/useCart'
import { useStoreConfig } from '@/hooks/useStoreConfig'
import { useApiResource } from '@/hooks/useApiResource'
import { CartSheet } from '@/components/store/cart/CartSheet'
import { CategoryNav } from '@/components/store/categories/CategoryNav'
import { LocaleSwitcher } from '@/components/store/LocaleSwitcher'
import { PrimaryNav } from '@/components/store/nav/PrimaryNav'
import { MobileNavDrawer } from '@/components/store/nav/MobileNavDrawer'
import { useSearchOverlay } from '@/components/store/search/SearchProvider'
import { layout } from '@/lib/styles'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/Provider'
import { buildPrimaryNavLinks } from '@/lib/nav'
import type { CategoryNode } from '@/lib/types/category'

export function StorefrontHeader() {
  const t = useT()
  const { openCart } = useCart()
  const itemCount = useCartItemCount()
  const { config } = useStoreConfig()
  const { data: catData } = useApiResource<{ categories: CategoryNode[] }>('/api/categories')
  const { openSearch } = useSearchOverlay()

  const categories = catData?.categories ?? []
  const primaryNavLinks = buildPrimaryNavLinks(config)

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b bg-background">
        <div className={cn(layout.bar, 'h-16 justify-between')}>
          {/* Store name / logo */}
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
                  className="object-contain object-left rtl:object-right"
                  unoptimized
                />
              </span>
            ) : (
              (config?.storeName ?? 'ShopFlare')
            )}
          </Link>

          {/* Desktop nav: PrimaryNav + CategoryNav (hidden on mobile) */}
          <div className="hidden md:flex items-center gap-4">
            <PrimaryNav links={primaryNavLinks} />
            <CategoryNav categories={categories} />
          </div>

          {/* Spacer — pushes actions to the end on desktop */}
          <div className="flex-1 hidden md:block" />

          {/* Actions cluster */}
          <div className="flex items-center gap-1">
            {/* Search button — shown on both desktop and mobile */}
            <Button
              variant="ghost"
              size="icon"
              aria-label={t.store.searchLabel}
              onClick={openSearch}
            >
              <Search className="h-5 w-5" />
            </Button>

            {/* Locale switcher — desktop only; self-hides when only 1 locale */}
            <div className="hidden md:flex">
              <LocaleSwitcher />
            </div>

            {/* Cart button */}
            <Button
              variant="ghost"
              size="icon"
              aria-label={t.store.openCart}
              className="relative"
              onClick={openCart}
            >
              <ShoppingCart className="h-5 w-5" />
              {itemCount > 0 && (
                <Badge className="absolute -top-1 -inset-e-1 flex h-4 w-4 items-center justify-center rounded-full p-0 text-[10px]">
                  {itemCount > 99 ? '99+' : itemCount}
                </Badge>
              )}
            </Button>

            {/* Mobile hamburger — MobileNavDrawer self-hides trigger on md+ */}
            <MobileNavDrawer links={primaryNavLinks} categories={categories} />
          </div>
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
