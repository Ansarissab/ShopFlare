import { describe, it, expect, vi } from 'vitest'
import { compressImage, COMPRESS_CONFIRM_THRESHOLD_BYTES } from '@/lib/image'

vi.mock('browser-image-compression', () => ({
  default: vi.fn(async (file: File, opts: Record<string, unknown>) => {
    // Simulate compression: return a smaller fake file
    const blob = new Blob(['compressed'], { type: (opts.fileType as string) ?? 'image/webp' })
    return new File([blob], file.name, { type: (opts.fileType as string) ?? 'image/webp' })
  }),
}))

import imageCompression from 'browser-image-compression'

describe('COMPRESS_CONFIRM_THRESHOLD_BYTES', () => {
  it('is 3 MB', () => {
    expect(COMPRESS_CONFIRM_THRESHOLD_BYTES).toBe(3 * 1024 * 1024)
  })
})

describe('compressImage', () => {
  it('returns originalBytes, compressedBytes and compressed file', async () => {
    const file = new File(['hello'.repeat(100)], 'photo.png', { type: 'image/png' })
    const result = await compressImage(file)
    expect(result.originalBytes).toBe(file.size)
    expect(typeof result.compressedBytes).toBe('number')
    expect(result.file).toBeInstanceOf(File)
  })

  it('passes default opts to imageCompression', async () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    await compressImage(file)
    expect(imageCompression).toHaveBeenCalledWith(file, expect.objectContaining({
      maxSizeMB: 1,
      maxWidthOrHeight: 2000,
      initialQuality: 0.8,
      useWebWorker: true,
      fileType: 'image/webp',
    }))
  })

  it('passes custom opts when provided', async () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    await compressImage(file, { maxSizeMB: 2, maxWidthOrHeight: 1200 })
    expect(imageCompression).toHaveBeenCalledWith(file, expect.objectContaining({
      maxSizeMB: 2,
      maxWidthOrHeight: 1200,
    }))
  })
})
