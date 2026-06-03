import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AdminPageHeaderProps } from '@/lib/types/admin'

export function AdminPageHeader({ title, actions, backHref }: AdminPageHeaderProps) {
  return (
    <div className="sticky top-0 z-20 -mx-6 -mt-6 mb-6 flex items-center justify-between border-b bg-background/95 px-6 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        {backHref && (
          <Link href={backHref} className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }))}>
            <ArrowLeft className="size-4" />
          </Link>
        )}
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
