'use client'

import Link from 'next/link'
import { useT } from '@/lib/i18n/Provider'
import type { PrimaryNavProps } from '@/lib/types/nav'

/**
 * Desktop primary links row — Shop, Track, FAQ, Blog (in order, feature-flagged).
 * Categories are handled separately by CategoryNav.
 * Hidden on small screens via `hidden md:flex`; Wave 2 places the hamburger there.
 * RTL-safe: uses `gap` utilities and logical CSS — no hard left/right offsets.
 */
export function PrimaryNav({ links }: PrimaryNavProps) {
  const t = useT()

  if (links.length === 0) return null

  return (
    <nav aria-label={t.store.menu} className="hidden md:flex items-center gap-6">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {t.store[link.labelKey]}
        </Link>
      ))}
    </nav>
  )
}
