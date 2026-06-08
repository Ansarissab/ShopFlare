// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { ImageUpload } from './ImageUpload'
import { en } from '@/lib/i18n/en'
import { MAX_IMAGE_BYTES } from '@/lib/constants'

vi.mock('next/image', async () => {
  const { createElement } = await import('react')
  return {
    default: (props: Record<string, unknown>) => {
      const { fill, priority, ...rest } = props
      return createElement('img', rest as React.ImgHTMLAttributes<HTMLImageElement>)
    },
  }
})

vi.mock('@/lib/api', () => ({
  apiUpload: vi.fn(() => Promise.resolve({ id: 'new', url: '/new.jpg' })),
  apiDelete: vi.fn(() => Promise.resolve({})),
}))

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

vi.mock('@/lib/image', () => ({
  compressImage: vi.fn((file: File) =>
    Promise.resolve({ file, originalBytes: file.size, compressedBytes: file.size }),
  ),
  COMPRESS_CONFIRM_THRESHOLD_BYTES: 3 * 1024 * 1024,
}))

import { apiUpload, apiDelete } from '@/lib/api'
import { compressImage } from '@/lib/image'
import { toast } from 'sonner'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function fileInput(): HTMLInputElement {
  return document.querySelector('input[type="file"]') as HTMLInputElement
}

describe('shared ImageUpload', () => {
  it('renders upload button', () => {
    render(<ImageUpload endpoint="/api/upload" onUploaded={vi.fn()} />)
    expect(screen.getByText(en.admin.uploadImage)).toBeTruthy()
  })

  it('clicking upload button triggers file input', () => {
    render(<ImageUpload endpoint="/api/upload" onUploaded={vi.fn()} />)
    const input = fileInput()
    const clickSpy = vi.spyOn(input, 'click')
    fireEvent.click(screen.getByText(en.admin.uploadImage))
    expect(clickSpy).toHaveBeenCalled()
  })

  it('does nothing when no file selected', async () => {
    render(<ImageUpload endpoint="/api/upload" onUploaded={vi.fn()} />)
    fireEvent.change(fileInput(), { target: { files: [] } })
    await Promise.resolve()
    expect(apiUpload).not.toHaveBeenCalled()
  })

  it('compresses and uploads file, calls onUploaded', async () => {
    const onUploaded = vi.fn()
    render(<ImageUpload endpoint="/api/upload" onUploaded={onUploaded} />)
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput(), { target: { files: [file] } })

    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith({ id: 'new', url: '/new.jpg' }))
    expect(compressImage).toHaveBeenCalledWith(file)
    expect(apiUpload).toHaveBeenCalledWith('/api/upload', expect.any(FormData))
    expect(toast.success).toHaveBeenCalledWith(en.admin.imageUploaded)
  })

  it('appends extraFields to FormData', async () => {
    const onUploaded = vi.fn()
    render(
      <ImageUpload
        endpoint="/api/upload"
        extraFields={{ variantId: 'v1', sortOrder: '0' }}
        onUploaded={onUploaded}
      />,
    )
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput(), { target: { files: [file] } })
    await waitFor(() => expect(apiUpload).toHaveBeenCalled())
    const fd = (apiUpload as ReturnType<typeof vi.fn>).mock.calls[0][1] as FormData
    expect(fd.get('variantId')).toBe('v1')
    expect(fd.get('sortOrder')).toBe('0')
  })

  it('toasts imageTooLarge when compressed size exceeds MAX_IMAGE_BYTES', async () => {
    vi.mocked(compressImage).mockResolvedValueOnce({
      file: new File(['x'], 'big.jpg'),
      originalBytes: 10_000_000,
      compressedBytes: MAX_IMAGE_BYTES + 1,
    })
    render(<ImageUpload endpoint="/api/upload" onUploaded={vi.fn()} />)
    fireEvent.change(fileInput(), { target: { files: [new File(['x'], 'big.jpg')] } })
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(en.errors.imageTooLarge))
    expect(apiUpload).not.toHaveBeenCalled()
  })

  it('toasts error message on upload failure', async () => {
    vi.mocked(apiUpload).mockRejectedValueOnce(new Error('upload fail'))
    render(<ImageUpload endpoint="/api/upload" onUploaded={vi.fn()} />)
    fireEvent.change(fileInput(), { target: { files: [new File(['x'], 'f.jpg')] } })
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('upload fail'))
  })

  it('toasts network error on non-Error failure', async () => {
    vi.mocked(compressImage).mockRejectedValueOnce('weird')
    render(<ImageUpload endpoint="/api/upload" onUploaded={vi.fn()} />)
    fireEvent.change(fileInput(), { target: { files: [new File(['x'], 'f.jpg')] } })
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(en.errors.networkError))
  })

  it('renders currentImages with delete buttons when deleteEndpoint provided', () => {
    const currentImages = [{ id: 'img1', url: '/img1.jpg' }]
    render(
      <ImageUpload
        endpoint="/api/upload"
        onUploaded={vi.fn()}
        onDeleted={vi.fn()}
        deleteEndpoint={(id) => `/api/images/${id}`}
        currentImages={currentImages}
      />,
    )
    expect(document.querySelector('img')).toBeTruthy()
    expect(screen.getByLabelText(en.admin.deleteImage)).toBeTruthy()
  })

  it('deletes image when delete button clicked', async () => {
    const onDeleted = vi.fn()
    render(
      <ImageUpload
        endpoint="/api/upload"
        onUploaded={vi.fn()}
        onDeleted={onDeleted}
        deleteEndpoint={(id) => `/api/images/${id}`}
        currentImages={[{ id: 'img1', url: '/img1.jpg' }]}
      />,
    )
    fireEvent.click(screen.getByLabelText(en.admin.deleteImage))
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith('img1'))
    expect(apiDelete).toHaveBeenCalledWith('/api/images/img1')
    expect(toast.success).toHaveBeenCalledWith(en.admin.imageDeleted)
  })

  it('toasts error on delete failure', async () => {
    vi.mocked(apiDelete).mockRejectedValueOnce(new Error('del fail'))
    render(
      <ImageUpload
        endpoint="/api/upload"
        onUploaded={vi.fn()}
        onDeleted={vi.fn()}
        deleteEndpoint={(id) => `/api/images/${id}`}
        currentImages={[{ id: 'img1', url: '/img1.jpg' }]}
      />,
    )
    fireEvent.click(screen.getByLabelText(en.admin.deleteImage))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(en.errors.networkError))
  })

  it('hides upload button when max reached', () => {
    render(
      <ImageUpload
        endpoint="/api/upload"
        onUploaded={vi.fn()}
        max={1}
        currentImages={[{ id: 'img1', url: '/img1.jpg' }]}
      />,
    )
    expect(screen.queryByText(en.admin.uploadImage)).toBeNull()
  })

  it('shows upload button when below max', () => {
    render(
      <ImageUpload
        endpoint="/api/upload"
        onUploaded={vi.fn()}
        max={2}
        currentImages={[{ id: 'img1', url: '/img1.jpg' }]}
      />,
    )
    expect(screen.getByText(en.admin.uploadImage)).toBeTruthy()
  })

  it('shows images without delete buttons when no deleteEndpoint', () => {
    render(
      <ImageUpload
        endpoint="/api/upload"
        onUploaded={vi.fn()}
        currentImages={[{ id: 'img1', url: '/img1.jpg' }]}
      />,
    )
    expect(document.querySelector('img')).toBeTruthy()
    expect(screen.queryByLabelText(en.admin.deleteImage)).toBeNull()
  })
})
