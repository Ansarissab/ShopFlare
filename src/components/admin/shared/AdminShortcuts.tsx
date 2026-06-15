'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { ADMIN_SHORTCUTS, ADMIN_CREATE_ROUTES } from '@/lib/constants'
import { ShortcutsHelpOverlay, useShortcutsHelp } from '@/components/shared/ShortcutsHelpOverlay'
import { useListNavRef } from '@/components/admin/shared/ListNavContext'
import type { ShortcutHandlers } from '@/lib/types/shortcuts'

/**
 * Mounts the admin keyboard shortcut engine.
 * Renders inside AdminShell (inside ListNavProvider) so it can forward
 * j/k/Enter to whichever list table is currently active.
 */
export default function AdminShortcuts() {
  const router = useRouter()
  const pathname = usePathname()
  const { open: helpOpen, setOpen: setHelpOpen, openHelp, closeHelp } = useShortcutsHelp()
  const navRef = useListNavRef()

  const handlers: ShortcutHandlers = {
    goOrders: () => router.push('/admin/orders'),
    goProducts: () => router.push('/admin/products'),
    goCoupons: () => router.push('/admin/coupons'),
    goAnalytics: () => router.push('/admin/analytics'),
    create: () => {
      const route = ADMIN_CREATE_ROUTES[pathname]
      if (route) router.push(route)
    },
    search: () => {
      if (typeof document !== 'undefined') {
        const el = document.querySelector<HTMLElement>('[data-shortcut-search]')
        el?.focus()
      }
    },
    help: openHelp,
    close: closeHelp,
    listNext: () => navRef?.current?.next(),
    listPrev: () => navRef?.current?.prev(),
    listOpen: () => navRef?.current?.open(),
    // store-only actions — no-ops in admin context
    cart: undefined,
  }

  useKeyboardShortcuts({ bindings: ADMIN_SHORTCUTS, handlers })

  return (
    <ShortcutsHelpOverlay open={helpOpen} onOpenChange={setHelpOpen} bindings={ADMIN_SHORTCUTS} />
  )
}
