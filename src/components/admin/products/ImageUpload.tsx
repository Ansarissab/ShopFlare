'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import imageCompression from 'browser-image-compression'
import { Button } from '@/components/ui/button'
import { en } from '@/lib/i18n/en'
import { apiUpload, apiDelete } from '@/lib/api'
import type { ProductImage } from '@/lib/types/store'

interface ImageUploadProps {
  variantId: string
  images: ProductImage[]
  onUploaded: (image: ProductImage) => void
  onDeleted: (imageId: string) => void
}

export function ImageUpload({ variantId, images, onUploaded, onDeleted }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.8,
        maxWidthOrHeight: 1200,
        useWebWorker: true,
      })

      const form = new FormData()
      form.append('file', compressed, file.name)
      form.append('variantId', variantId)
      form.append('sortOrder', String(images.length))

      const image = await apiUpload<ProductImage>('/api/admin/products/images/upload', form)
      onUploaded(image)
      toast.success(en.admin.imageUploaded)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : en.errors.networkError)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleDelete(imageId: string) {
    try {
      await apiDelete(`/api/admin/products/images/${imageId}`)
      onDeleted(imageId)
      toast.success(en.admin.imageDeleted)
    } catch {
      toast.error(en.errors.networkError)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {images.map((img) => (
          <div key={img.id} className="group relative size-20 rounded-md overflow-hidden border">
            <Image
              src={img.url}
              alt=""
              fill
              className="object-cover"
              sizes="80px"
            />
            <button
              type="button"
              onClick={() => handleDelete(img.id)}
              className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label={en.admin.deleteImage}
            >
              <Trash2 className="size-4 text-white" />
            </button>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="size-20 flex-col gap-1 text-xs"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="size-4" aria-hidden />
          {uploading ? '…' : en.admin.uploadImage}
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleFileChange}
      />
    </div>
  )
}
