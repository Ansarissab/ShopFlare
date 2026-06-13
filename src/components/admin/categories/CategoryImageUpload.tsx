'use client'

import { ImageUpload } from '@/components/shared/ImageUpload'
import { useT } from '@/lib/i18n/Provider'
import type { CategoryImageUploadProps } from '@/lib/types/category'

export function CategoryImageUpload({
  categoryId,
  currentImageUrl,
  onUploadComplete,
  onRemove,
}: CategoryImageUploadProps) {
  const t = useT()
  const currentImages = currentImageUrl ? [{ id: 'category-image', url: currentImageUrl }] : []

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-medium text-muted-foreground">{t.admin.categoryImage}</p>
      <ImageUpload<{ imageUrl: string }>
        endpoint={`/api/admin/categories/${categoryId}/image`}
        max={1}
        currentImages={currentImages}
        onUploaded={(r) => onUploadComplete(r.imageUrl)}
        onDeleted={() => onRemove()}
        deleteEndpoint={() => `/api/admin/categories/${categoryId}/image`}
      />
    </div>
  )
}
