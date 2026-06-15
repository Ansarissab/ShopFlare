'use client'

import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { ShortcutsHelpOverlay, useShortcutsHelp } from '@/components/shared/ShortcutsHelpOverlay'
import { STORE_SHORTCUTS } from '@/lib/constants'
import { useSearchOverlay } from '@/components/store/search/SearchProvider'
import { useCart } from '@/hooks/useCart'

/**
 * Headless-ish component that wires the phase-31 keyboard-shortcut engine
 * into the storefront. Must be mounted inside <SearchProvider>.
 *
 * Actions:
 *   /        → open search overlay
 *   c        → open cart
 *   ?        → open shortcuts help overlay
 *   Escape   → close whichever panel is open (help → search → cart precedence)
 */
export function StoreShortcuts() {
  const { open: helpOpen, setOpen, openHelp, closeHelp } = useShortcutsHelp()
  const { open: searchOpen, openSearch, closeSearch } = useSearchOverlay()
  const { isOpen: cartOpen, openCart, closeCart } = useCart()

  const handlers = {
    search: openSearch,
    cart: openCart,
    help: openHelp,
    close: () => {
      if (helpOpen) {
        closeHelp()
      } else if (searchOpen) {
        closeSearch()
      } else if (cartOpen) {
        closeCart()
      }
    },
    // Admin-only actions — not handled in storefront
    goOrders: undefined,
    goProducts: undefined,
    goCoupons: undefined,
    goAnalytics: undefined,
    create: undefined,
    listNext: undefined,
    listPrev: undefined,
    listOpen: undefined,
  }

  useKeyboardShortcuts({ bindings: STORE_SHORTCUTS, handlers })

  return <ShortcutsHelpOverlay open={helpOpen} onOpenChange={setOpen} bindings={STORE_SHORTCUTS} />
}
