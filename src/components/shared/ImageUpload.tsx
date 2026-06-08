'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Upload, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { en } from '@/lib/i18n/en'
import { apiUpload, apiDelete } from '@/lib/api'
import { compressImage, COMPRESS_CONFIRM_THRESHOLD_BYTES } from '@/lib/image'
import { MAX_IMAGE_BYTES } from '@/lib/constants'

export interface SharedImageItem {
  id: string
  url: string
}

export interface SharedImageUploadProps<T = unknown> {
  /** POST endpoint for upload */
  endpoint: string
  /** Extra FormData fields appended on upload */
  extraFields?: Record<string, string>
  /** Called with raw API response on successful upload */
  onUploaded: (result: T) => void
  /** Called with image id when deleted (requires deleteEndpoint) */
  onDeleted?: (id: string) => void
  /** DELETE endpoint template; receives image id */
  deleteEndpoint?: (id: string) => string
  /** Max number of images to show (undefined = unlimited) */
  max?: number
  /** Already-uploaded images to display */
  currentImages?: SharedImageItem[]
}

// Phase 17 shell — uploads compress via compressImage() and POST to endpoint.
// Confirmation dialog (for files > COMPRESS_CONFIRM_THRESHOLD_BYTES) is Phase 18.
export function ImageUpload<T = unknown>({
  endpoint,
  extraFields,
  onUploaded,
  onDeleted,
  deleteEndpoint,
  max,
  currentImages = [],
}: SharedImageUploadProps<T>) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const canAdd = max === undefined || currentImages.length < max

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const result = await compressImage(file)

      if (result.compressedBytes > MAX_IMAGE_BYTES) {
        toast.error(en.errors.imageTooLarge)
        return
      }

      // Phase 18 will add confirm dialog when result.originalBytes > COMPRESS_CONFIRM_THRESHOLD_BYTES.
      void COMPRESS_CONFIRM_THRESHOLD_BYTES

      const form = new FormData()
      form.append('file', result.file, file.name)
      if (extraFields) {
        for (const [k, v] of Object.entries(extraFields)) {
          form.append(k, v)
        }
      }

      const uploaded = await apiUpload<T>(endpoint, form)
      onUploaded(uploaded)
      toast.success(en.admin.imageUploaded)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : en.errors.networkError)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleDelete(id: string) {
    if (!deleteEndpoint) return
    try {
      await apiDelete(deleteEndpoint(id))
      onDeleted?.(id)
      toast.success(en.admin.imageDeleted)
    } catch {
      toast.error(en.errors.networkError)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        {currentImages.map((img) => (
          <div key={img.id} className="group relative size-16 sm:size-20 rounded-md overflow-hidden border">
            <Image src={img.url} alt="" fill className="object-cover" sizes="80px" />
            {deleteEndpoint && (
              <button
                type="button"
                onClick={() => handleDelete(img.id)}
                className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label={en.admin.deleteImage}
              >
                <Trash2 className="size-4 text-white" />
              </button>
            )}
          </div>
        ))}

        {canAdd && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="size-16 sm:size-20 flex-col gap-1 text-[10px] leading-tight whitespace-normal text-center px-1"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="size-4" aria-hidden />
            {uploading ? '…' : en.admin.uploadImage}
          </Button>
        )}
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
