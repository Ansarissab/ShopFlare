'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { ProductForm } from '@/components/admin/products/ProductForm'
import { en } from '@/lib/i18n/en'
import { useApiResource } from '@/hooks/useApiResource'
import type { ProductWithVariants } from '@/lib/types/store'

export default function EditProductPage() {
  const params = useParams<{ id: string }>()
  const { data, loading, notFound } = useApiResource<ProductWithVariants>(
    params?.id ? `/api/products/${params.id}` : null,
  )

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link href="/admin/products" className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }))}>
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{en.admin.editProduct}</h1>
      </div>

      {loading ? (
        <div className="flex flex-col gap-4 max-w-3xl">
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      ) : notFound ? (
        <div className="py-20 text-center text-sm text-muted-foreground">
          Product not found.{' '}
          <Link href="/admin/products" className="text-primary underline">Back</Link>
        </div>
      ) : (
        <ProductForm initial={data ?? undefined} />
      )}
    </div>
  )
}
