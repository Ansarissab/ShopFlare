import imageCompression from 'browser-image-compression'

export const COMPRESS_CONFIRM_THRESHOLD_BYTES = 3 * 1024 * 1024 // 3 MB

export interface CompressResult {
  file: File
  originalBytes: number
  compressedBytes: number
}

export interface CompressOptions {
  maxSizeMB?: number
  maxWidthOrHeight?: number
  initialQuality?: number
  fileType?: string
}

// Preferred output formats — tried in order; first to succeed wins.
const PREFERRED_TYPES = ['image/avif', 'image/webp', 'image/jpeg'] as const

export async function compressImage(file: File, opts?: CompressOptions): Promise<CompressResult> {
  const originalBytes = file.size
  const baseOpts = {
    maxSizeMB: opts?.maxSizeMB ?? 1,
    maxWidthOrHeight: opts?.maxWidthOrHeight ?? 2000,
    initialQuality: opts?.initialQuality ?? 0.8,
    useWebWorker: true,
  }

  // Explicit fileType: use it, no fallback.
  if (opts?.fileType) {
    const compressed = await imageCompression(file, { ...baseOpts, fileType: opts.fileType })
    return { file: compressed, originalBytes, compressedBytes: compressed.size }
  }

  // AVIF → WebP → JPEG: AVIF encode is not universally supported in canvas paths.
  let lastErr: unknown
  for (const fileType of PREFERRED_TYPES) {
    try {
      const compressed = await imageCompression(file, { ...baseOpts, fileType })
      return { file: compressed, originalBytes, compressedBytes: compressed.size }
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr
}
