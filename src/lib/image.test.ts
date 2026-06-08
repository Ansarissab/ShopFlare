import { describe, it, expect, vi, beforeEach } from 'vitest'
import { compressImage, COMPRESS_CONFIRM_THRESHOLD_BYTES } from '@/lib/image'

const mockCompress = vi.fn()

vi.mock('browser-image-compression', () => ({
  default: (...args: Parameters<typeof mockCompress>) => mockCompress(...args),
}))

// imported only to confirm module wires through mockCompress
import 'browser-image-compression'

function defaultImpl(file: File, opts: Record<string, unknown>) {
  const blob = new Blob(['compressed'], { type: (opts.fileType as string) ?? 'image/webp' })
  return Promise.resolve(new File([blob], file.name, { type: (opts.fileType as string) ?? 'image/webp' }))
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCompress.mockImplementation(defaultImpl)
})

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

  it('tries AVIF first by default', async () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    await compressImage(file)
    expect(mockCompress).toHaveBeenCalledWith(file, expect.objectContaining({
      maxSizeMB: 1,
      maxWidthOrHeight: 2000,
      initialQuality: 0.8,
      useWebWorker: true,
      fileType: 'image/avif',
    }))
  })

  it('falls back to WebP when AVIF throws', async () => {
    mockCompress.mockRejectedValueOnce(new Error('AVIF not supported'))
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    const result = await compressImage(file)
    expect(result.file.type).toBe('image/webp')
    expect(mockCompress).toHaveBeenCalledTimes(2)
  })

  it('falls back to JPEG when both AVIF and WebP throw', async () => {
    mockCompress
      .mockRejectedValueOnce(new Error('AVIF not supported'))
      .mockRejectedValueOnce(new Error('WebP not supported'))
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    const result = await compressImage(file)
    expect(result.file.type).toBe('image/jpeg')
    expect(mockCompress).toHaveBeenCalledTimes(3)
  })

  it('throws if all formats fail', async () => {
    mockCompress.mockRejectedValue(new Error('all fail'))
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    await expect(compressImage(file)).rejects.toThrow('all fail')
  })

  it('uses explicit fileType without fallback when opts.fileType provided', async () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    await compressImage(file, { fileType: 'image/png' })
    expect(mockCompress).toHaveBeenCalledTimes(1)
    expect(mockCompress).toHaveBeenCalledWith(file, expect.objectContaining({
      fileType: 'image/png',
    }))
  })

  it('passes custom opts when provided', async () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    await compressImage(file, { maxSizeMB: 2, maxWidthOrHeight: 1200 })
    expect(mockCompress).toHaveBeenCalledWith(file, expect.objectContaining({
      maxSizeMB: 2,
      maxWidthOrHeight: 1200,
    }))
  })
})
