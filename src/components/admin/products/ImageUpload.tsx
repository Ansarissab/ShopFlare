'use client'

import {
  ImageUpload as SharedImageUpload,
  type SharedImageItem,
} from '@/components/shared/ImageUpload'
import { MAX_IMAGES_PER_VARIANT } from '@/lib/constants'
import type { ProductImage } from '@/lib/types/product'

interface ImageUploadProps {
  variantId: string
  images: ProductImage[]
  onUploaded: (image: ProductImage) => void
  onDeleted: (imageId: string) => void
}

export function ImageUpload({ variantId, images, onUploaded, onDeleted }: ImageUploadProps) {
  const currentImages: SharedImageItem[] = images.map((img) => ({ id: img.id, url: img.url }))
  return (
    <SharedImageUpload<ProductImage>
      endpoint="/api/admin/products/images/upload"
      extraFields={{ variantId, sortOrder: String(images.length) }}
      max={MAX_IMAGES_PER_VARIANT}
      currentImages={currentImages}
      onUploaded={onUploaded}
      onDeleted={onDeleted}
      deleteEndpoint={(id) => `/api/admin/products/images/${id}`}
    />
  )
}
