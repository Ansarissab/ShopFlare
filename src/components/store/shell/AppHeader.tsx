'use client'

import { ShoppingCart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIsStandalone } from '@/hooks/useDisplayMode'
import { useCartItemCount, useCart } from '@/hooks/useCart'
import { useStoreConfig } from '@/hooks/useStoreConfig'
import { layout, safeArea } from '@/lib/styles'
import { useT } from '@/lib/i18n/Provider'

export function AppHeader() {
  const t = useT()
  const isStandalone = useIsStandalone()
  const cartCount = useCartItemCount()
  const openCart = useCart((s) => s.openCart)
  const { config } = useStoreConfig()

  if (!isStandalone) return null

  return (
    <header
      data-app-header
      className={cn(layout.appHeader, safeArea.x, 'flex items-center justify-between px-4 h-12')}
    >
      <span className="font-semibold text-sm truncate">{config?.storeName ?? 'Store'}</span>
      <button
        onClick={openCart}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg hover:bg-accent"
        aria-label={t.store.openCart}
      >
        <ShoppingCart className="h-5 w-5" />
        {cartCount > 0 && (
          <span className="absolute top-1 inset-e-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
            {cartCount > 9 ? '9+' : cartCount}
          </span>
        )}
      </button>
    </header>
  )
}
