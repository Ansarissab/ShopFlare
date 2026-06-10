'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Upload, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { en } from '@/lib/i18n/en'
import { apiUpload, apiDelete } from '@/lib/api'
import { compressImage, COMPRESS_CONFIRM_THRESHOLD_BYTES, type CompressResult } from '@/lib/image'
import { MAX_IMAGE_BYTES } from '@/lib/constants'
import { formatBytes } from '@/lib/utils'

export interface SharedImageItem {
  id: string
  url: string
}

export interface SharedImageUploadProps<T = unknown> {
  endpoint: string
  extraFields?: Record<string, string>
  onUploaded: (result: T) => void
  onDeleted?: (id: string) => void
  deleteEndpoint?: (id: string) => string
  max?: number
  currentImages?: SharedImageItem[]
}

interface ConfirmState {
  result: CompressResult
  previewUrl: string
  form: FormData
  overCap: boolean
}

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
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)

  const canAdd = max === undefined || currentImages.length < max

  function buildForm(result: CompressResult, originalName: string): FormData {
    const form = new FormData()
    form.append('file', result.file, originalName)
    if (extraFields) {
      for (const [k, v] of Object.entries(extraFields)) {
        form.append(k, v)
      }
    }
    return form
  }

  async function doUpload(form: FormData) {
    const uploaded = await apiUpload<T>(endpoint, form)
    onUploaded(uploaded)
    toast.success(en.admin.imageUploaded)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const result = await compressImage(file)
      const form = buildForm(result, file.name)

      if (result.originalBytes > COMPRESS_CONFIRM_THRESHOLD_BYTES) {
        // Large original: show confirm dialog (Upload disabled if compressed still over cap).
        const previewUrl = URL.createObjectURL(result.file)
        setConfirmState({
          result,
          previewUrl,
          form,
          overCap: result.compressedBytes > MAX_IMAGE_BYTES,
        })
        return
      }

      if (result.compressedBytes > MAX_IMAGE_BYTES) {
        toast.error(en.errors.imageTooLarge)
        return
      }

      await doUpload(form)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : en.errors.networkError)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleConfirmUpload() {
    if (!confirmState || confirmState.overCap) return
    closeDialog()
    setUploading(true)
    try {
      await doUpload(confirmState.form)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : en.errors.networkError)
    } finally {
      setUploading(false)
    }
  }

  function closeDialog() {
    if (confirmState) {
      URL.revokeObjectURL(confirmState.previewUrl)
      setConfirmState(null)
    }
    if (inputRef.current) inputRef.current.value = ''
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

  const savedPct = confirmState
    ? Math.round(
        (1 - confirmState.result.compressedBytes / confirmState.result.originalBytes) * 100,
      )
    : 0

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {currentImages.map((img) => (
            <div
              key={img.id}
              className="group relative size-16 sm:size-20 rounded-md overflow-hidden border"
            >
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

      <Dialog
        open={confirmState !== null}
        onOpenChange={(open) => {
          if (!open) closeDialog()
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{en.admin.compressTitle}</DialogTitle>
            <DialogDescription>{en.admin.compressBody}</DialogDescription>
          </DialogHeader>

          {confirmState && (
            <div className="flex flex-col gap-3">
              <div className="relative w-full aspect-video rounded-md overflow-hidden border bg-muted">
                <Image
                  src={confirmState.previewUrl}
                  alt=""
                  fill
                  className="object-contain"
                  sizes="400px"
                  unoptimized
                />
              </div>

              <div className="text-sm space-y-0.5">
                <p>
                  {en.admin.compressSizeLabel
                    .replace('{original}', formatBytes(confirmState.result.originalBytes))
                    .replace('{compressed}', formatBytes(confirmState.result.compressedBytes))}
                </p>
                {savedPct > 0 && (
                  <p className="text-muted-foreground">
                    {en.admin.compressSavedLabel.replace('{pct}', String(savedPct))}
                  </p>
                )}
                {confirmState.overCap && (
                  <p className="text-destructive text-xs mt-1">
                    {en.admin.compressTooLarge.replace(
                      '{mb}',
                      String(Math.round(MAX_IMAGE_BYTES / 1024 / 1024)),
                    )}
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDialog}>
              {en.admin.compressCancel}
            </Button>
            <Button
              type="button"
              onClick={handleConfirmUpload}
              disabled={!confirmState || confirmState.overCap}
            >
              {en.admin.compressConfirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
