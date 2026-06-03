'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { en } from '@/lib/i18n/en'
import { useApiResource } from '@/hooks/useApiResource'
import type { ProductWithVariants } from '@/lib/types/product'

interface ProductsResponse {
  products: ProductWithVariants[]
}

export default function AdminProductsPage() {
  const { data, loading } = useApiResource<ProductsResponse>('/api/admin/products')

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        title={en.admin.products}
        actions={
          <Link href="/admin/products/new" className={cn(buttonVariants({ size: 'sm' }))}>
            <Plus className="size-4 mr-1.5" aria-hidden />
            {en.admin.addProduct}
          </Link>
        }
      />

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {!data?.products?.length ? (
            <div className="py-20 text-center text-sm text-muted-foreground">
              No products yet.{' '}
              <Link href="/admin/products/new" className="text-primary underline">
                Add your first product
              </Link>
            </div>
          ) : (
            data.products.map(({ product, variants }) => (
              <div
                key={product.id}
                className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
              >
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{product.name}</span>
                    <Badge variant={product.active ? 'default' : 'secondary'}>
                      {product.active ? en.admin.active : en.admin.inactive}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {variants.length} variant{variants.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <Link href={`/admin/products/${product.id}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
                  {en.admin.editProduct}
                </Link>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
