'use client'

import { ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useCart, useCartItemCount } from '@/hooks/useCart'
import { CartSheet } from '@/components/store/cart/CartSheet'

export function StorefrontHeader() {
  const { openCart } = useCart()
  const itemCount = useCartItemCount()

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b bg-background">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Store name */}
          <a href="/" className="text-lg font-semibold tracking-tight text-foreground hover:opacity-80 transition-opacity">
            Store
          </a>

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
              <Badge
                className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full p-0 text-xs"
              >
                {itemCount > 99 ? '99+' : itemCount}
              </Badge>
            )}
          </Button>
        </div>
      </header>

      {/* CartSheet available globally via header */}
      <CartSheet />
    </>
  )
}
