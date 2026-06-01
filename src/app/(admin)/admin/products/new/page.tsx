import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ProductForm } from '@/components/admin/products/ProductForm'
import { en } from '@/lib/i18n/en'

export default function NewProductPage() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link href="/admin/products" className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }))}>
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{en.admin.addProduct}</h1>
      </div>

      <ProductForm />
    </div>
  )
}
