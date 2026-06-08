'use client'

import { ImageUpload } from '@/components/shared/ImageUpload'
import { en } from '@/lib/i18n/en'
import type { CategoryImageUploadProps } from '@/lib/types/category'

export function CategoryImageUpload({
  categoryId,
  currentImageUrl,
  onUploadComplete,
  onRemove,
}: CategoryImageUploadProps) {
  const currentImages = currentImageUrl
    ? [{ id: 'category-image', url: currentImageUrl }]
    : []

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-medium text-muted-foreground">{en.admin.categoryImage}</p>
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
