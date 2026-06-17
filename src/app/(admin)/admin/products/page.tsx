'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, ExternalLink } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { layout } from '@/lib/styles'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { useT } from '@/lib/i18n/Provider'
import { useApiResource } from '@/hooks/useApiResource'
import { useListNavigation } from '@/hooks/useListNavigation'
import { useRegisterListNav } from '@/components/admin/shared/ListNavContext'
import type { ProductsResponse } from '@/lib/types/admin'

export default function AdminProductsPage() {
  const t = useT()
  const router = useRouter()
  const { data, loading } = useApiResource<ProductsResponse>('/api/admin/products')

  const items = data?.products ?? []
  const { next, prev, open, isActive } = useListNavigation({
    items,
    onOpen: (item) => router.push(`/admin/products/${item.product.id}`),
  })
  useRegisterListNav({ next, prev, open })

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        title={t.admin.products}
        actions={
          <Link href="/admin/products/new" className={cn(buttonVariants({ size: 'sm' }))}>
            <Plus className="size-4 mr-1.5" aria-hidden />
            {t.admin.addProduct}
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
              {t.admin.noProductsYet}{' '}
              <Link href="/admin/products/new" className="text-primary underline">
                {t.admin.addFirstProduct}
              </Link>
            </div>
          ) : (
            data.products.map(({ product, variants }, index) => (
              <div
                key={product.id}
                className={cn(
                  'flex items-center justify-between rounded-lg border bg-card px-4 py-3',
                  isActive(index) && layout.activeRow,
                )}
              >
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{product.name}</span>
                    <Badge variant={product.active ? 'default' : 'secondary'}>
                      {product.active ? t.admin.active : t.admin.inactive}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {variants.length === 1
                      ? t.admin.variantCount.replace('{n}', String(variants.length))
                      : t.admin.variantCountPlural.replace('{n}', String(variants.length))}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/product/${product.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
                  >
                    <ExternalLink className="size-3.5 mr-1" aria-hidden />
                    {t.admin.viewProduct}
                  </Link>
                  <Link
                    href={`/admin/products/${product.id}`}
                    className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
                  >
                    {t.admin.editProduct}
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
