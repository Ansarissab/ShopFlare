'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { compressImage } from '@/lib/image'
import { Button } from '@/components/ui/button'
import { en } from '@/lib/i18n/en'
import { apiUpload, apiDelete } from '@/lib/api'
import type { CategoryImageUploadProps } from '@/lib/types/category'

export function CategoryImageUpload({
  categoryId,
  currentImageUrl,
  onUploadComplete,
  onRemove,
}: CategoryImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const { file: compressed } = await compressImage(file)

      const form = new FormData()
      form.append('file', compressed, file.name)

      const result = await apiUpload<{ imageUrl: string }>(
        `/api/admin/categories/${categoryId}/image`,
        form,
      )
      onUploadComplete(result.imageUrl)
      toast.success(en.admin.imageUploaded)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : en.errors.networkError)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleRemove() {
    setRemoving(true)
    try {
      await apiDelete(`/api/admin/categories/${categoryId}/image`)
      onRemove()
      toast.success(en.admin.imageDeleted)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : en.errors.networkError)
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-medium text-muted-foreground">{en.admin.categoryImage}</p>

      {currentImageUrl ? (
        <div className="flex items-start gap-3">
          <div className="relative size-24 rounded-md overflow-hidden border shrink-0">
            <Image
              src={currentImageUrl}
              alt=""
              fill
              className="object-cover"
              sizes="96px"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRemove}
            disabled={removing}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="size-3.5 mr-1" aria-hidden />
            {removing ? en.admin.saving : en.admin.deleteImage}
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="size-3.5 mr-1.5" aria-hidden />
          {uploading ? en.admin.saving : en.admin.uploadImage}
        </Button>
      )}

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
