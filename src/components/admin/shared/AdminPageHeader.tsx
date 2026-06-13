'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/Provider'
import type { AdminPageHeaderProps } from '@/lib/types/admin'

// Client component: rendered by both client admin pages and the two server
// admin pages (a server component may render a client child). useT() resolves
// via the admin TProvider; an async server getT() here would break the client
// pages that import and render this directly.
export function AdminPageHeader({ title, actions, backHref }: AdminPageHeaderProps) {
  const t = useT()
  return (
    <div className="sticky top-0 z-20 -mx-4 -mt-4 mb-6 flex flex-wrap items-center justify-between gap-2 border-b bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:-mt-6 sm:px-6">
      <div className="flex items-center gap-2 sm:gap-3">
        {backHref && (
          <Link
            href={backHref}
            aria-label={t.admin.back}
            className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }))}
          >
            <ArrowLeft className="size-4" aria-hidden />
          </Link>
        )}
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:gap-3">{actions}</div>}
    </div>
  )
}
