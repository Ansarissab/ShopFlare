'use client'

import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { useParams } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { buttonVariants } from '@/components/ui/button'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { ProductForm } from '@/components/admin/products/ProductForm'
import { useT } from '@/lib/i18n/Provider'
import { cn } from '@/lib/utils'
import { useApiResource } from '@/hooks/useApiResource'
import type { ProductWithVariants } from '@/lib/types/product'

export default function EditProductPage() {
  const t = useT()
  const params = useParams<{ id: string }>()
  const { data, loading, notFound } = useApiResource<ProductWithVariants>(
    params?.id ? `/api/admin/products/${params.id}` : null,
  )

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        title={t.admin.editProduct}
        backHref="/admin/products"
        actions={
          params?.id && (
            <Link
              href={`/product/${params.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            >
              <ExternalLink className="size-3.5 mr-1.5" aria-hidden />
              {t.admin.viewProduct}
            </Link>
          )
        }
      />

      {loading ? (
        <div className="flex flex-col gap-4 max-w-3xl">
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      ) : notFound ? (
        <div className="py-20 text-center text-sm text-muted-foreground">
          Product not found.{' '}
          <Link href="/admin/products" className="text-primary underline">
            Back
          </Link>
        </div>
      ) : (
        <ProductForm initial={data ?? undefined} />
      )}
    </div>
  )
}
