import Link from 'next/link'
import { ShieldX } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { en } from '@/lib/i18n/en'

// Shared "Access Denied" UI. Rendered both by the /admin/unauthorized route and
// inline by the admin layout's auth guard. Kept as a plain component (not a
// route page) so it can be safely imported into the layout — importing a Next
// route page module as a component breaks under the OpenNext/workerd bundle.
export function Unauthorized() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <ShieldX className="size-12 text-muted-foreground" aria-hidden />
      <h1 className="text-2xl font-bold tracking-tight">{en.admin.unauthorizedTitle}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{en.admin.unauthorizedMessage}</p>
      <Link href="/" className={buttonVariants({ variant: 'outline' })}>
        {en.admin.unauthorizedBack}
      </Link>
    </div>
  )
}
