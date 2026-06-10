'use client'

import { useCallback, useState } from 'react'
import { useParams } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { CategoryForm } from '@/components/admin/categories/CategoryForm'
import { CategoryImageUpload } from '@/components/admin/categories/CategoryImageUpload'
import { CategoryProductsManager } from '@/components/admin/categories/CategoryProductsManager'
import { en } from '@/lib/i18n/en'
import { useApiResource } from '@/hooks/useApiResource'
import type { CategoryDetailResponse, CategoryTreeResponse } from '@/lib/types/category'

export default function EditCategoryPage() {
  const params = useParams<{ id: string }>()
  const categoryId = params?.id ?? null

  const [detailPath, setDetailPath] = useState(
    categoryId ? `/api/admin/categories/${categoryId}` : null,
  )

  const refetch = useCallback(() => {
    if (categoryId) {
      setDetailPath(`/api/admin/categories/${categoryId}?_t=${Date.now()}`)
    }
  }, [categoryId])

  const { data: detail, loading: detailLoading } =
    useApiResource<CategoryDetailResponse>(detailPath)
  const { data: tree, loading: treeLoading } =
    useApiResource<CategoryTreeResponse>('/api/admin/categories')

  const loading = detailLoading || treeLoading

  // Flat list of all categories except self — for parent picker
  const parentOptions = (tree?.categories ?? [])
    .filter((c) => c.id !== categoryId)
    .map(({ children: _c, productCount: _p, ...rest }) => rest)

  // Image state — track locally so remove/upload updates without full refetch
  const [imageUrl, setImageUrl] = useState<string | null | undefined>(undefined)
  // Sync from fetched data on first load
  const resolvedImageUrl = imageUrl === undefined ? detail?.category.imageUrl : imageUrl

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader title={en.admin.editCategory} backHref="/admin/categories" />

      {loading ? (
        <div className="flex flex-col gap-3 max-w-2xl">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-md" />
          ))}
        </div>
      ) : detail ? (
        <>
          {/* Edit form */}
          <div className="rounded-lg border p-5">
            <CategoryForm
              category={detail.category}
              parentOptions={parentOptions}
              onSuccess={refetch}
            />
          </div>

          {/* Category image */}
          <div className="rounded-lg border p-5 flex flex-col gap-4">
            <h2 className="text-sm font-semibold">{en.admin.categoryImage}</h2>
            <CategoryImageUpload
              categoryId={detail.category.id}
              currentImageUrl={resolvedImageUrl}
              onUploadComplete={(url) => setImageUrl(url)}
              onRemove={() => setImageUrl(null)}
            />
          </div>

          {/* Products manager */}
          <CategoryProductsManager
            categoryId={detail.category.id}
            initialProducts={detail.products}
          />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{en.admin.noCategories}</p>
      )}
    </div>
  )
}
