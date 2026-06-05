'use client'

import { useRouter } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { CategoryForm } from '@/components/admin/categories/CategoryForm'
import { en } from '@/lib/i18n/en'
import { useApiResource } from '@/hooks/useApiResource'
import type { CategoryTreeResponse } from '@/lib/types/category'

export default function NewCategoryPage() {
  const router = useRouter()
  const { data, loading } = useApiResource<CategoryTreeResponse>('/api/admin/categories')

  // Flatten tree to a flat list of top-level categories for parent picker
  const parentOptions = (data?.categories ?? []).map(({ children: _c, productCount: _p, ...rest }) => rest)

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        title={en.admin.addCategory}
        backHref="/admin/categories"
      />

      {loading ? (
        <div className="flex flex-col gap-3 max-w-2xl">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-md" />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border p-5">
          <CategoryForm
            parentOptions={parentOptions}
            onSuccess={() => router.push('/admin/categories')}
          />
        </div>
      )}
    </div>
  )
}
