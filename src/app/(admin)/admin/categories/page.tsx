'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { CategoryTree } from '@/components/admin/categories/CategoryTree'
import { useT } from '@/lib/i18n/Provider'
import { useApiResource } from '@/hooks/useApiResource'
import { apiDelete, apiPut } from '@/lib/api'
import type { CategoryTreeResponse, CategoryNode } from '@/lib/types/category'
import type { Category } from '@/lib/types/category'

export default function AdminCategoriesPage() {
  const t = useT()
  const [resourcePath, setResourcePath] = useState('/api/admin/categories')

  const refetch = useCallback(() => {
    setResourcePath(`/api/admin/categories?_t=${Date.now()}`)
  }, [])

  const { data, loading } = useApiResource<CategoryTreeResponse>(resourcePath)

  async function handleReorder(categoryId: string, direction: 'up' | 'down') {
    // Collect flat list to find neighbors
    const flatList = flattenTree(data?.categories ?? [])
    const idx = flatList.findIndex((c) => c.id === categoryId)
    if (idx === -1) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= flatList.length) return

    const current = flatList[idx]
    const neighbor = flatList[swapIdx]

    try {
      await Promise.all([
        apiPut(`/api/admin/categories/${current.id}`, { sortOrder: neighbor.sortOrder }),
        apiPut(`/api/admin/categories/${neighbor.id}`, { sortOrder: current.sortOrder }),
      ])
      refetch()
    } catch {
      toast.error(t.errors.networkError)
    }
  }

  async function handleDelete(categoryId: string) {
    if (!window.confirm(t.admin.deleteCategoryConfirm)) return
    try {
      await apiDelete(`/api/admin/categories/${categoryId}`)
      toast.success(t.admin.categoryDeleted)
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.errors.networkError)
    }
  }

  function handleEdit(category: Category) {
    // Navigate to edit page
    window.location.href = `/admin/categories/${category.id}`
  }

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        title={t.admin.categories}
        actions={
          <Link href="/admin/categories/new" className={cn(buttonVariants({ size: 'sm' }))}>
            <Plus className="size-3.5 mr-1" aria-hidden />
            {t.admin.addCategory}
          </Link>
        }
      />

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      ) : (
        <CategoryTree
          categories={data?.categories ?? []}
          onReorder={handleReorder}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}

function flattenTree(nodes: CategoryNode[]): CategoryNode[] {
  const result: CategoryNode[] = []
  for (const node of nodes) {
    result.push(node)
    result.push(...flattenTree(node.children))
  }
  return result
}
