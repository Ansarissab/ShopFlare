'use client'

import Link from 'next/link'
import { Separator } from '@/components/ui/separator'
import { en } from '@/lib/i18n/en'
import { layout } from '@/lib/styles'
import { useStoreConfig } from '@/hooks/useStoreConfig'

export function StorefrontFooter() {
  const { config } = useStoreConfig()
  const year = new Date().getFullYear()

  return (
    <footer className="border-t bg-background">
      <div className={layout.page}>
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          {/* Store name + year */}
          <span className="text-sm font-semibold text-foreground">
            {config?.storeName ?? 'ShopFlare'} © {year}
          </span>

          {/* Policy links */}
          <nav className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            <Link href="/policy/shipping" className="hover:text-foreground transition-colors px-2 py-1">
              {en.policies.shipping}
            </Link>
            <Separator orientation="vertical" className="h-4" />
            <Link href="/policy/returns" className="hover:text-foreground transition-colors px-2 py-1">
              {en.policies.returns}
            </Link>
            <Separator orientation="vertical" className="h-4" />
            <Link href="/policy/privacy" className="hover:text-foreground transition-colors px-2 py-1">
              {en.policies.privacy}
            </Link>
            <Separator orientation="vertical" className="h-4" />
            <Link href="/policy/terms" className="hover:text-foreground transition-colors px-2 py-1">
              {en.policies.terms}
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}
