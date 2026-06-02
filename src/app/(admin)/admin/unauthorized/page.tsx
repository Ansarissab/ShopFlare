import Link from 'next/link'
import { ShieldX } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { en } from '@/lib/i18n/en'

export default function UnauthorizedPage() {
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
