'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetClose, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { LocaleSwitcher } from '@/components/store/LocaleSwitcher'
import { useT, useLocale } from '@/lib/i18n/Provider'
import { LOCALES } from '@/lib/constants'
import type { MobileNavDrawerProps } from '@/lib/types/nav'

/**
 * Mobile hamburger trigger + slide-in drawer.
 * - Trigger is `md:hidden` so it only appears on small screens.
 * - Drawer opens from the inline-start side (left in LTR, right in RTL).
 * - Primary nav links received as prop from StorefrontHeader (computed once there).
 * - Categories rendered as a flat link list (parents + their children indented);
 *   no DropdownMenu — cleaner on touch screens.
 * - LocaleSwitcher included at the bottom of the drawer.
 * - SheetContent rendered with showCloseButton=false; we provide our own SheetClose
 *   with a localised aria-label so screen readers hear the translated string.
 */
export function MobileNavDrawer({ links, categories }: MobileNavDrawerProps) {
  const t = useT()
  const isRtl = LOCALES[useLocale()].dir === 'rtl'
  const [open, setOpen] = useState(false)

  function close() {
    setOpen(false)
  }

  return (
    <>
      {/* Hamburger trigger — visible only on mobile */}
      <Button
        variant="ghost"
        size="icon"
        aria-label={t.store.openMenu}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="md:hidden"
        onClick={() => setOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Drawer */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side={isRtl ? 'right' : 'left'}
          showCloseButton={false}
          className="flex flex-col w-72 p-0"
        >
          <SheetHeader className="px-4 pt-4 pb-2">
            <SheetTitle>{t.store.menu}</SheetTitle>
          </SheetHeader>

          {/* Custom close button — localised aria-label, positioned at top-end corner */}
          <SheetClose
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t.store.closeMenu}
                className="absolute top-3 inset-e-3"
              />
            }
            onClick={close}
          >
            <X className="h-4 w-4" />
          </SheetClose>

          <nav
            aria-label={t.store.menu}
            className="flex flex-col gap-1 px-4 py-2 flex-1 overflow-y-auto"
          >
            {/* Primary links */}
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                prefetch={false}
                onClick={close}
                className="block rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                {t.store[link.labelKey]}
              </Link>
            ))}

            {/* Categories section — flat list: parent then children (indented) */}
            {categories.length > 0 && (
              <div className="mt-4">
                <p className="px-3 pb-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t.store.categoriesNav}
                </p>
                {categories.map((cat) => (
                  <div key={cat.id}>
                    <Link
                      href={`/category/${cat.slug}`}
                      prefetch={false}
                      onClick={close}
                      className="block rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors font-medium"
                    >
                      {cat.name}
                    </Link>
                    {cat.children.map((child) => (
                      <Link
                        key={child.id}
                        href={`/category/${child.slug}`}
                        prefetch={false}
                        onClick={close}
                        className="block rounded-md ps-6 pe-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        {child.name}
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </nav>

          {/* Locale switcher at the bottom */}
          <div className="px-4 py-3 border-t">
            <LocaleSwitcher />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
