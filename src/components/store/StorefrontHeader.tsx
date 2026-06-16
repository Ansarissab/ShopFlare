'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { ShoppingCart, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useCart, useCartItemCount } from '@/hooks/useCart'
import { useStoreConfig } from '@/hooks/useStoreConfig'
import { useApiResource } from '@/hooks/useApiResource'
import { CategoryNav } from '@/components/store/categories/CategoryNav'
import { LocaleSwitcher } from '@/components/store/LocaleSwitcher'
import { PrimaryNav } from '@/components/store/nav/PrimaryNav'
import { useSearchOverlay } from '@/components/store/search/SearchProvider'
import { layout } from '@/lib/styles'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/Provider'
import { buildPrimaryNavLinks } from '@/lib/nav'
import type { CategoryNode } from '@/lib/types/category'
import type { CartSheetProps } from '@/lib/types/cart'
import type { MobileNavDrawerProps } from '@/lib/types/nav'

// ─── Lazy chunks (ssr: false) ─────────────────────────────────────────────────
//
// CartSheet: only needed after user opens the cart — kept off the initial bundle.
// MobileNavDrawer: mobile-only (md:hidden trigger inside); no SSR value.
// Both follow the same pattern as SearchProvider's LazyOverlay.

const LazyCartSheet = dynamic<CartSheetProps>(
  () => import('@/components/store/cart/CartSheet').then((mod) => ({ default: mod.CartSheet })),
  { ssr: false },
)

const LazyMobileNavDrawer = dynamic<MobileNavDrawerProps>(
  () =>
    import('@/components/store/nav/MobileNavDrawer').then((mod) => ({
      default: mod.MobileNavDrawer,
    })),
  { ssr: false },
)

export function StorefrontHeader() {
  const t = useT()
  const { openCart } = useCart()
  const itemCount = useCartItemCount()
  const { config } = useStoreConfig()
  const { data: catData } = useApiResource<{ categories: CategoryNode[] }>('/api/categories')
  const { openSearch } = useSearchOverlay()

  // Gate: mount CartSheet only after the user opens the cart for the first time.
  // Mirrors SearchProvider's hasOpened pattern. On first click: openCart() sets
  // Zustand isOpen=true synchronously → re-render flips cartEverOpened=true →
  // LazyCartSheet mounts and immediately reads isOpen=true → sheet opens.
  // No race: Zustand state is already true when CartSheet first reads it.
  const cartIsOpen = useCart((s) => s.isOpen)
  const [cartEverOpened, setCartEverOpened] = useState(false)
  if (cartIsOpen && !cartEverOpened) {
    // Inline state sync: safe in render when state only ever flips false→true.
    // Avoids a useEffect flicker cycle.
    setCartEverOpened(true)
  }

  const categories = catData?.categories ?? []
  const primaryNavLinks = buildPrimaryNavLinks(config)

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b bg-background">
        <div className={cn(layout.bar, 'h-16 justify-between gap-4')}>
          {/* Store name / logo */}
          <Link
            href="/"
            className="shrink-0 text-lg font-semibold tracking-tight text-foreground hover:opacity-80 transition-opacity"
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
            <LazyMobileNavDrawer links={primaryNavLinks} categories={categories} />
          </div>
        </div>
      </header>

      {/* CartSheet — mounted only after first open (chunk stays off critical path).
          Once mounted it remains in the DOM so open/close cycles don't re-mount. */}
      {cartEverOpened && (
        <LazyCartSheet
          flatRateCents={config?.flatShippingRateCents ?? 0}
          thresholdCents={config?.freeShippingThresholdCents ?? 0}
        />
      )}
    </>
  )
}
