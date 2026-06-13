'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { useApiResource } from '@/hooks/useApiResource'
import { useT } from '@/lib/i18n/Provider'
import type { CategoryNode, ProductCategoryPickerProps } from '@/lib/types/category'

export function ProductCategoryPicker({ selectedIds, onChange }: ProductCategoryPickerProps) {
  const t = useT()
  const { data, loading } = useApiResource<{ categories: CategoryNode[] }>('/api/categories')

  const categories = data?.categories ?? []

  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }

  if (loading) {
    return (
      <div className="max-h-[200px] overflow-y-auto rounded-md border p-2">
        <p className="text-xs text-muted-foreground px-1 py-0.5">Loading…</p>
      </div>
    )
  }

  if (categories.length === 0) {
    return (
      <div className="max-h-[200px] overflow-y-auto rounded-md border p-2">
        <p className="text-xs text-muted-foreground px-1 py-0.5">{t.admin.noCategories}</p>
      </div>
    )
  }

  return (
    <div className="max-h-[200px] overflow-y-auto rounded-md border p-2 flex flex-col gap-1">
      {categories.map((parent) => (
        <div key={parent.id}>
          {/* Top-level category */}
          <div className="flex items-center gap-2 px-1 py-0.5">
            <Checkbox
              id={`cat-${parent.id}`}
              checked={selectedIds.includes(parent.id)}
              onCheckedChange={() => toggle(parent.id)}
            />
            <Label htmlFor={`cat-${parent.id}`} className="text-sm font-normal cursor-pointer">
              {parent.name}
            </Label>
          </div>

          {/* Child categories — indented */}
          {parent.children.map((child) => (
            <div key={child.id} className="flex items-center gap-2 px-1 py-0.5 pl-6">
              <Checkbox
                id={`cat-${child.id}`}
                checked={selectedIds.includes(child.id)}
                onCheckedChange={() => toggle(child.id)}
              />
              <Label htmlFor={`cat-${child.id}`} className="text-sm font-normal cursor-pointer">
                {parent.name} › {child.name}
              </Label>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
