// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { CategoryImageUpload } from './CategoryImageUpload'
import { en } from '@/lib/i18n/en'
import { apiUpload, apiDelete } from '@/lib/api'
import { compressImage } from '@/lib/image'
import { toast } from 'sonner'

vi.mock('next/image', async () => {
  const { createElement } = await import('react')
  return {
    default: (props: Record<string, unknown>) => {
      const { fill, priority, unoptimized, ...rest } = props
      return createElement('img', rest)
    },
  }
})

vi.mock('@/lib/api', () => ({
  apiUpload: vi.fn(() => Promise.resolve({ imageUrl: '/uploaded.jpg' })),
  apiDelete: vi.fn(() => Promise.resolve({})),
}))

vi.mock('@/lib/image', () => ({
  compressImage: vi.fn((file: File) =>
    Promise.resolve({ file, originalBytes: file.size, compressedBytes: file.size }),
  ),
  COMPRESS_CONFIRM_THRESHOLD_BYTES: 3 * 1024 * 1024,
}))

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

vi.stubGlobal('URL', {
  createObjectURL: vi.fn(() => 'blob:mock'),
  revokeObjectURL: vi.fn(),
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const baseProps = {
  categoryId: 'cat-1',
  currentImageUrl: null,
  onUploadComplete: vi.fn(),
  onRemove: vi.fn(),
}

function fileInput(): HTMLInputElement {
  return document.querySelector('input[type="file"]') as HTMLInputElement
}

describe('CategoryImageUpload', () => {
  it('renders upload button and category image label when no current image', () => {
    render(<CategoryImageUpload {...baseProps} />)
    expect(screen.getByText(en.admin.uploadImage)).toBeTruthy()
    expect(screen.getByText(en.admin.categoryImage)).toBeTruthy()
  })

  it('clicking upload button triggers the hidden file input', () => {
    render(<CategoryImageUpload {...baseProps} />)
    const input = fileInput()
    const clickSpy = vi.spyOn(input, 'click')
    fireEvent.click(screen.getByText(en.admin.uploadImage))
    expect(clickSpy).toHaveBeenCalled()
  })

  it('renders image preview and delete button when currentImageUrl exists', () => {
    render(<CategoryImageUpload {...baseProps} currentImageUrl="/existing.jpg" />)
    expect(screen.getByLabelText(en.admin.deleteImage)).toBeTruthy()
    const img = document.querySelector('img') as HTMLImageElement
    expect(img.getAttribute('src')).toBe('/existing.jpg')
  })

  it('hides upload button when image already present (max=1)', () => {
    render(<CategoryImageUpload {...baseProps} currentImageUrl="/existing.jpg" />)
    expect(screen.queryByText(en.admin.uploadImage)).toBeNull()
  })

  it('uploads a file: compresses, calls apiUpload, fires onUploadComplete + success toast', async () => {
    const onUploadComplete = vi.fn()
    render(<CategoryImageUpload {...baseProps} onUploadComplete={onUploadComplete} />)
    const file = new File(['x'], 'pic.png', { type: 'image/png' })
    fireEvent.change(fileInput(), { target: { files: [file] } })

    await waitFor(() => expect(onUploadComplete).toHaveBeenCalledWith('/uploaded.jpg'))
    expect(compressImage).toHaveBeenCalled()
    expect(apiUpload).toHaveBeenCalledWith(
      '/api/admin/categories/cat-1/image',
      expect.any(FormData),
    )
    expect(toast.success).toHaveBeenCalledWith(en.admin.imageUploaded)
  })

  it('does nothing when no file is selected', async () => {
    render(<CategoryImageUpload {...baseProps} />)
    fireEvent.change(fileInput(), { target: { files: [] } })
    await Promise.resolve()
    expect(apiUpload).not.toHaveBeenCalled()
  })

  it('shows error toast with message when upload throws', async () => {
    vi.mocked(apiUpload).mockRejectedValueOnce(new Error('boom'))
    render(<CategoryImageUpload {...baseProps} />)
    const file = new File(['x'], 'pic.png', { type: 'image/png' })
    fireEvent.change(fileInput(), { target: { files: [file] } })
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('boom'))
  })

  it('shows network error toast when upload throws a non-Error', async () => {
    vi.mocked(compressImage).mockRejectedValueOnce('weird')
    render(<CategoryImageUpload {...baseProps} />)
    const file = new File(['x'], 'pic.png', { type: 'image/png' })
    fireEvent.change(fileInput(), { target: { files: [file] } })
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(en.errors.networkError))
  })

  it('removes image: calls apiDelete with category endpoint, fires onRemove + success toast', async () => {
    const onRemove = vi.fn()
    render(
      <CategoryImageUpload {...baseProps} currentImageUrl="/existing.jpg" onRemove={onRemove} />,
    )
    fireEvent.click(screen.getByLabelText(en.admin.deleteImage))
    await waitFor(() => expect(onRemove).toHaveBeenCalled())
    expect(apiDelete).toHaveBeenCalledWith('/api/admin/categories/cat-1/image')
    expect(toast.success).toHaveBeenCalledWith(en.admin.imageDeleted)
  })

  it('shows error toast when remove throws', async () => {
    vi.mocked(apiDelete).mockRejectedValueOnce(new Error('del-fail'))
    render(<CategoryImageUpload {...baseProps} currentImageUrl="/existing.jpg" />)
    fireEvent.click(screen.getByLabelText(en.admin.deleteImage))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(en.errors.networkError))
  })
})
