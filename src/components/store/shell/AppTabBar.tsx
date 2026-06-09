'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, ShoppingBag, Package, Menu, ShoppingCart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIsStandalone } from '@/hooks/useDisplayMode'
import { useCartItemCount, useCart } from '@/hooks/useCart'
import { en } from '@/lib/i18n/en'
import { vibrate } from '@/lib/utils/haptics'
import { layout, safeArea } from '@/lib/styles'
import { useStoreConfig } from '@/hooks/useStoreConfig'
import { catalogHref } from '@/lib/nav'

type Tab = {
  key: string
  label: string
  href?: string
  icon: React.ComponentType<{ className?: string }>
  onClick?: () => void
}

export function AppTabBar() {
  const isStandalone = useIsStandalone()
  const pathname = usePathname()
  const cartCount = useCartItemCount()
  const openCart = useCart((s) => s.openCart)
  const { config } = useStoreConfig()

  // Only show in standalone mode
  if (!isStandalone) return null

  const tabs: Tab[] = [
    { key: 'home',  label: en.pwa.tabHome,  href: '/',                                      icon: Home },
    { key: 'shop',  label: en.pwa.tabShop,  href: catalogHref(config?.landingEnabled), icon: ShoppingBag },
    {
      key: 'cart',
      label: en.pwa.tabCart,
      icon: ShoppingCart,
      onClick: () => { vibrate('light'); openCart() },
    },
    { key: 'track', label: en.pwa.tabTrack, href: '/track',   icon: Package },
    { key: 'menu',  label: en.pwa.tabMenu,  href: '/#menu',   icon: Menu },
  ]

  return (
    <nav
      data-tab-bar
      className={cn(layout.tabBar, safeArea.bottom, 'flex items-center justify-around')}
      aria-label="Main navigation"
    >
      {tabs.map((tab) => {
        const isActive = tab.href ? pathname === tab.href || pathname.startsWith(tab.href + '/') : false
        const Icon = tab.icon

        const inner = (
          <span className="flex flex-col items-center gap-0.5 relative">
            <span className="relative">
              <Icon className={cn('h-5 w-5 transition-colors', isActive ? 'text-primary' : 'text-muted-foreground')} />
              {tab.key === 'cart' && cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
            </span>
            <span className={cn('text-[10px] transition-colors', isActive ? 'text-primary font-medium' : 'text-muted-foreground')}>
              {tab.label}
            </span>
          </span>
        )

        if (tab.onClick) {
          return (
            <button
              key={tab.key}
              onClick={tab.onClick}
              className="flex flex-1 items-center justify-center py-2 min-h-[48px]"
              aria-label={tab.label}
            >
              {inner}
            </button>
          )
        }

        return (
          <Link
            key={tab.key}
            href={tab.href!}
            className="flex flex-1 items-center justify-center py-2 min-h-[48px]"
            onClick={() => vibrate('light')}
            aria-label={tab.label}
          >
            {inner}
          </Link>
        )
      })}
    </nav>
  )
}
