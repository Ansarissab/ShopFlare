// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { ImageUpload } from './ImageUpload'
import { en } from '@/lib/i18n/en'
import type { ProductImage } from '@/lib/types/product'

vi.mock('next/image', async () => {
  const { createElement } = await import('react')
  return {
    default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean; unoptimized?: boolean }) => {
      const { fill, priority, unoptimized, ...rest } = props
      return createElement('img', rest)
    },
  }
})

vi.mock('@/lib/api', () => ({
  apiUpload: vi.fn(() => Promise.resolve({ id: 'img-new', url: '/new.jpg' })),
  apiDelete: vi.fn(() => Promise.resolve({})),
}))

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

vi.mock('@/lib/image', () => ({
  compressImage: vi.fn((file: File) => Promise.resolve({ file, originalBytes: file.size, compressedBytes: file.size })),
  COMPRESS_CONFIRM_THRESHOLD_BYTES: 3 * 1024 * 1024,
}))

vi.stubGlobal('URL', {
  createObjectURL: vi.fn(() => 'blob:mock'),
  revokeObjectURL: vi.fn(),
})

import { apiUpload, apiDelete } from '@/lib/api'
import { toast } from 'sonner'
import { compressImage } from '@/lib/image'

function makeImage(id: string): ProductImage {
  return {
    id,
    variantId: 'var-1',
    url: `/img/${id}.jpg`,
    r2Key: `key/${id}`,
    sortOrder: 0,
  } as ProductImage
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function renderUpload(images: ProductImage[] = []) {
  const onUploaded = vi.fn()
  const onDeleted = vi.fn()
  const result = render(
    <ImageUpload variantId="var-1" images={images} onUploaded={onUploaded} onDeleted={onDeleted} />,
  )
  return { ...result, onUploaded, onDeleted }
}

describe('ImageUpload', () => {
  it('renders existing images and the upload button', () => {
    const { container } = renderUpload([makeImage('a'), makeImage('b')])
    const imgs = container.querySelectorAll('img')
    expect(imgs.length).toBe(2)
    expect(screen.getByText(en.admin.uploadImage)).toBeTruthy()
  })

  it('clicking the upload button triggers the hidden file input click', () => {
    const { container } = renderUpload()
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const clickSpy = vi.spyOn(input, 'click')
    fireEvent.click(screen.getByText(en.admin.uploadImage))
    expect(clickSpy).toHaveBeenCalled()
  })

  it('selecting a file compresses, uploads, calls onUploaded and toasts success', async () => {
    const { container, onUploaded } = renderUpload([makeImage('a')])
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['x'], 'photo.png', { type: 'image/png' })
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith({ id: 'img-new', url: '/new.jpg' }))
    expect(compressImage).toHaveBeenCalled()
    expect(apiUpload).toHaveBeenCalledWith('/api/admin/products/images/upload', expect.any(FormData))
    expect(toast.success).toHaveBeenCalledWith(en.admin.imageUploaded)
    expect(input.value).toBe('')
  })

  it('does nothing when no file selected', async () => {
    const { container, onUploaded } = renderUpload()
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [] } })
    expect(onUploaded).not.toHaveBeenCalled()
    expect(apiUpload).not.toHaveBeenCalled()
  })

  it('upload failure with Error toasts its message', async () => {
    ;(apiUpload as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('too big'))
    const { container } = renderUpload()
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File(['x'], 'p.png', { type: 'image/png' })] } })
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('too big'))
  })

  it('upload failure with non-Error toasts network error', async () => {
    ;(compressImage as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce('weird')
    const { container } = renderUpload()
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File(['x'], 'p.png', { type: 'image/png' })] } })
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(en.errors.networkError))
  })

  it('delete image calls apiDelete, onDeleted and toasts success', async () => {
    const { onDeleted } = renderUpload([makeImage('a')])
    fireEvent.click(screen.getByLabelText(en.admin.deleteImage))
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith('a'))
    expect(apiDelete).toHaveBeenCalledWith('/api/admin/products/images/a')
    expect(toast.success).toHaveBeenCalledWith(en.admin.imageDeleted)
  })

  it('delete failure toasts network error', async () => {
    ;(apiDelete as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'))
    const { onDeleted } = renderUpload([makeImage('a')])
    fireEvent.click(screen.getByLabelText(en.admin.deleteImage))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(en.errors.networkError))
    expect(onDeleted).not.toHaveBeenCalled()
  })
})
