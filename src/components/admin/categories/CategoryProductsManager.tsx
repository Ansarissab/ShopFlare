'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { en } from '@/lib/i18n/en'
import { apiGet, apiPut, ApiError } from '@/lib/api'
import type { ProductWithVariants } from '@/lib/types/product'

interface CategoryProductsManagerProps {
  categoryId: string
  initialProducts: ProductWithVariants[]
}

interface ProductsResponse {
  products: ProductWithVariants[]
}

export function CategoryProductsManager({
  categoryId,
  initialProducts,
}: CategoryProductsManagerProps) {
  // Products assigned to this category (ordered)
  const [assigned, setAssigned] = useState<ProductWithVariants[]>(initialProducts)
  // All products fetched for the picker
  const [allProducts, setAllProducts] = useState<ProductWithVariants[]>([])
  const [loadingAll, setLoadingAll] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    apiGet<ProductsResponse>('/api/admin/products')
      .then((res) => setAllProducts(res.products ?? []))
      .catch(() => setAllProducts([]))
      .finally(() => setLoadingAll(false))
  }, [])

  async function handleAddProduct(item: ProductWithVariants) {
    const alreadyAssigned = assigned.some((a) => a.product.id === item.product.id)
    if (alreadyAssigned) return

    const newAssigned = [...assigned, item]
    setSaving(true)
    try {
      const existingCategoryIds = item.categoryIds ?? []
      await apiPut(`/api/admin/products/${item.product.id}/categories`, {
        categoryIds: [...existingCategoryIds, categoryId],
      })
      setAssigned(newAssigned)
      setShowPicker(false)
      setSearch('')
      toast.success(en.admin.categoryUpdated)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : en.errors.networkError)
    } finally {
      setSaving(false)
    }
  }

  async function handleRemoveProduct(item: ProductWithVariants) {
    const newAssigned = assigned.filter((a) => a.product.id !== item.product.id)
    setSaving(true)
    try {
      const remainingCategoryIds = (item.categoryIds ?? []).filter((id) => id !== categoryId)
      await apiPut(`/api/admin/products/${item.product.id}/categories`, {
        categoryIds: remainingCategoryIds,
      })
      setAssigned(newAssigned)
      toast.success(en.admin.categoryUpdated)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : en.errors.networkError)
    } finally {
      setSaving(false)
    }
  }

  async function handleReorder(index: number, direction: 'up' | 'down') {
    const newAssigned = [...assigned]
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= newAssigned.length) return;
    [newAssigned[index], newAssigned[swapIndex]] = [newAssigned[swapIndex], newAssigned[index]]

    setSaving(true)
    try {
      await apiPut(`/api/admin/products/categories/${categoryId}/reorder`, {
        productIds: newAssigned.map((p) => p.product.id),
      })
      setAssigned(newAssigned)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : en.errors.networkError)
    } finally {
      setSaving(false)
    }
  }

  const assignedIds = new Set(assigned.map((a) => a.product.id))
  const filteredPicker = allProducts.filter(
    ({ product }) =>
      !assignedIds.has(product.id) &&
      product.name.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="rounded-lg border p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{en.admin.categoryProducts}</h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowPicker((v) => !v)}
          disabled={saving}
        >
          <Plus className="size-3.5 mr-1" aria-hidden />
          {en.admin.addProductsToCategory}
        </Button>
      </div>

      {/* Product picker */}
      {showPicker && (
        <div className="rounded-md border p-3 flex flex-col gap-2 bg-muted/30">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            className="rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {loadingAll ? (
            <div className="flex flex-col gap-1.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full rounded-md" />
              ))}
            </div>
          ) : filteredPicker.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No products to add.</p>
          ) : (
            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
              {filteredPicker.map((item) => (
                <button
                  key={item.product.id}
                  type="button"
                  className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
                  onClick={() => handleAddProduct(item)}
                  disabled={saving}
                >
                  <span>{item.product.name}</span>
                  <Plus className="size-3.5 text-muted-foreground" aria-hidden />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Assigned products list */}
      {assigned.length === 0 ? (
        <p className="text-sm text-muted-foreground">{en.admin.noCategories}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {assigned.map((item, idx) => (
            <div
              key={item.product.id}
              className="flex items-center justify-between rounded-md border bg-card px-3 py-2.5"
            >
              <span className="text-sm font-medium">{item.product.name}</span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => handleReorder(idx, 'up')}
                  disabled={saving || idx === 0}
                  aria-label="Move up"
                >
                  <ChevronUp className="size-3.5" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => handleReorder(idx, 'down')}
                  disabled={saving || idx === assigned.length - 1}
                  aria-label="Move down"
                >
                  <ChevronDown className="size-3.5" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive hover:text-destructive"
                  onClick={() => handleRemoveProduct(item)}
                  disabled={saving}
                  aria-label="Remove from category"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
