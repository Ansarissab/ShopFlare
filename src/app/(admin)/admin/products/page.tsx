'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, ExternalLink, List, LayoutGrid, ImageIcon } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { layout } from '@/lib/styles'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import AdminSearch from '@/components/admin/shared/AdminSearch'
import { useT } from '@/lib/i18n/Provider'
import { useApiResource } from '@/hooks/useApiResource'
import { useListNavigation } from '@/hooks/useListNavigation'
import { useRegisterListNav } from '@/components/admin/shared/ListNavContext'
import type { ProductsResponse, ProductViewMode, AdminProductCardProps } from '@/lib/types/admin'

const VIEW_STORAGE_KEY = 'admin:products:view'

// ─── ProductCard (grid) ───────────────────────────────────────────────────────

function AdminProductCard({ product, variants, isActive }: AdminProductCardProps) {
  const t = useT()
  const primaryImageUrl = variants
    .flatMap((v) => v.images)
    .sort((a, b) => a.sortOrder - b.sortOrder)[0]?.url
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border bg-card px-4 py-3',
        isActive && layout.activeRow,
      )}
    >
      <div className="flex items-start gap-3">
        {/* Thumbnail */}
        {primaryImageUrl ? (
          <Image
            src={primaryImageUrl}
            alt={product.name}
            width={48}
            height={48}
            className="size-12 shrink-0 rounded-md object-cover"
          />
        ) : (
          <div className="size-12 shrink-0 rounded-md bg-muted flex items-center justify-center">
            <ImageIcon className="size-5 text-muted-foreground" aria-hidden />
          </div>
        )}
        <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
          <span className="font-medium leading-snug">{product.name}</span>
          <Badge variant={product.active ? 'default' : 'secondary'} className="shrink-0">
            {product.active ? t.admin.active : t.admin.inactive}
          </Badge>
        </div>
      </div>
      <span className="text-xs text-muted-foreground">
        {variants.length === 1
          ? t.admin.variantCount.replace('{n}', String(variants.length))
          : t.admin.variantCountPlural.replace('{n}', String(variants.length))}
      </span>
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
  )
}

// ─── AdminProductsPage ────────────────────────────────────────────────────────

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

  // ─── View mode (localStorage-persisted, SSR-safe) ─────────────────────────
  const [viewMode, setViewMode] = useState<ProductViewMode>('list')

  useEffect(() => {
    try {
      const stored = localStorage.getItem(VIEW_STORAGE_KEY)
      if (stored === 'grid' || stored === 'list') setViewMode(stored)
    } catch {
      // localStorage unavailable (private browsing / SSR) — keep default
    }
  }, [])

  function handleViewChange(mode: ProductViewMode) {
    setViewMode(mode)
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, mode)
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        title={t.admin.products}
        actions={
          <div className="flex items-center gap-2">
            {/* Global search — unchanged; data-shortcut-search keeps '/' focus */}
            <div className="max-w-50 sm:max-w-xs">
              <AdminSearch />
            </div>

            {/* View toggle */}
            <div className="flex items-center rounded-md border">
              <button
                type="button"
                onClick={() => handleViewChange('list')}
                aria-label={t.admin.viewList}
                aria-pressed={viewMode === 'list'}
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'icon' }),
                  'rounded-r-none border-r h-8 w-8',
                  viewMode === 'list' && 'bg-accent text-accent-foreground',
                )}
              >
                <List className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => handleViewChange('grid')}
                aria-label={t.admin.viewGrid}
                aria-pressed={viewMode === 'grid'}
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'icon' }),
                  'rounded-l-none h-8 w-8',
                  viewMode === 'grid' && 'bg-accent text-accent-foreground',
                )}
              >
                <LayoutGrid className="size-4" aria-hidden />
              </button>
            </div>

            {/* Add Product */}
            <Link href="/admin/products/new" className={cn(buttonVariants({ size: 'sm' }))}>
              <Plus className="size-4 mr-1.5" aria-hidden />
              {t.admin.addProduct}
            </Link>
          </div>
        }
      />

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          {!data?.products?.length ? (
            <div className="py-20 text-center text-sm text-muted-foreground">
              {t.admin.noProductsYet}{' '}
              <Link href="/admin/products/new" className="text-primary underline">
                {t.admin.addFirstProduct}
              </Link>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.products.map(({ product, variants }, index) => (
                <AdminProductCard
                  key={product.id}
                  product={product}
                  variants={variants}
                  isActive={isActive(index)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {data.products.map(({ product, variants }, index) => (
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
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
