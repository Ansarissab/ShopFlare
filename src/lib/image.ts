import imageCompression from 'browser-image-compression'

export const COMPRESS_CONFIRM_THRESHOLD_BYTES = 3 * 1024 * 1024  // 3 MB

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

export async function compressImage(file: File, opts?: CompressOptions): Promise<CompressResult> {
  const originalBytes = file.size
  const compressed = await imageCompression(file, {
    maxSizeMB:       opts?.maxSizeMB       ?? 1,
    maxWidthOrHeight: opts?.maxWidthOrHeight ?? 2000,
    initialQuality:  opts?.initialQuality  ?? 0.8,
    useWebWorker:    true,
    fileType:        opts?.fileType        ?? 'image/webp',
  })
  return {
    file: compressed,
    originalBytes,
    compressedBytes: compressed.size,
  }
}
