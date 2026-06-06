// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { CategoryImageUpload } from './CategoryImageUpload'
import { en } from '@/lib/i18n/en'
import { apiUpload, apiDelete } from '@/lib/api'
import imageCompression from 'browser-image-compression'
import { toast } from 'sonner'

vi.mock('next/image', async () => {
  const { createElement } = await import('react')
  return {
    default: (props: Record<string, unknown>) => {
      const { fill, priority, ...rest } = props
      return createElement('img', rest)
    },
  }
})

vi.mock('@/lib/api', () => ({
  apiUpload: vi.fn(() => Promise.resolve({ imageUrl: '/uploaded.jpg' })),
  apiDelete: vi.fn(() => Promise.resolve({})),
}))

vi.mock('browser-image-compression', () => ({
  default: vi.fn((file: File) => Promise.resolve(file)),
}))

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

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
  it('renders upload button when no current image', () => {
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
    expect(screen.getByText(en.admin.deleteImage)).toBeTruthy()
    const img = document.querySelector('img') as HTMLImageElement
    expect(img.getAttribute('src')).toBe('/existing.jpg')
  })

  it('uploads a file: compresses, calls apiUpload, fires onUploadComplete + success toast', async () => {
    const onUploadComplete = vi.fn()
    render(<CategoryImageUpload {...baseProps} onUploadComplete={onUploadComplete} />)
    const file = new File(['x'], 'pic.png', { type: 'image/png' })
    fireEvent.change(fileInput(), { target: { files: [file] } })

    await waitFor(() => expect(onUploadComplete).toHaveBeenCalledWith('/uploaded.jpg'))
    expect(imageCompression).toHaveBeenCalled()
    expect(apiUpload).toHaveBeenCalledWith('/api/admin/categories/cat-1/image', expect.any(FormData))
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
    vi.mocked(apiUpload).mockRejectedValueOnce('weird')
    render(<CategoryImageUpload {...baseProps} />)
    const file = new File(['x'], 'pic.png', { type: 'image/png' })
    fireEvent.change(fileInput(), { target: { files: [file] } })
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(en.errors.networkError))
  })

  it('removes image: calls apiDelete, fires onRemove + success toast', async () => {
    const onRemove = vi.fn()
    render(<CategoryImageUpload {...baseProps} currentImageUrl="/existing.jpg" onRemove={onRemove} />)
    fireEvent.click(screen.getByText(en.admin.deleteImage))
    await waitFor(() => expect(onRemove).toHaveBeenCalled())
    expect(apiDelete).toHaveBeenCalledWith('/api/admin/categories/cat-1/image')
    expect(toast.success).toHaveBeenCalledWith(en.admin.imageDeleted)
  })

  it('shows error toast when remove throws', async () => {
    vi.mocked(apiDelete).mockRejectedValueOnce(new Error('del-fail'))
    render(<CategoryImageUpload {...baseProps} currentImageUrl="/existing.jpg" />)
    fireEvent.click(screen.getByText(en.admin.deleteImage))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('del-fail'))
  })

  it('does nothing when files list is null (optional-chaining branch)', async () => {
    render(<CategoryImageUpload {...baseProps} />)
    fireEvent.change(fileInput(), { target: { files: null } })
    await Promise.resolve()
    expect(apiUpload).not.toHaveBeenCalled()
  })

  it('shows saving label and disables upload button while uploading', async () => {
    let resolveUpload: (v: { imageUrl: string }) => void = () => {}
    vi.mocked(apiUpload).mockReturnValueOnce(
      new Promise((res) => { resolveUpload = res }),
    )
    render(<CategoryImageUpload {...baseProps} />)
    const file = new File(['x'], 'pic.png', { type: 'image/png' })
    fireEvent.change(fileInput(), { target: { files: [file] } })

    // pending state → button shows saving label and is disabled
    await waitFor(() => expect(screen.getByText(en.admin.saving)).toBeTruthy())
    const btn = screen.getByText(en.admin.saving).closest('button') as HTMLButtonElement
    expect(btn.disabled).toBe(true)

    resolveUpload({ imageUrl: '/uploaded.jpg' })
    await waitFor(() => expect(screen.getByText(en.admin.uploadImage)).toBeTruthy())
  })

  it('shows saving label and disables delete button while removing', async () => {
    let resolveDel: (v: unknown) => void = () => {}
    vi.mocked(apiDelete).mockReturnValueOnce(
      new Promise<void>((res) => { resolveDel = res as (v: unknown) => void }),
    )
    render(<CategoryImageUpload {...baseProps} currentImageUrl="/existing.jpg" />)
    fireEvent.click(screen.getByText(en.admin.deleteImage))

    await waitFor(() => expect(screen.getByText(en.admin.saving)).toBeTruthy())
    const btn = screen.getByText(en.admin.saving).closest('button') as HTMLButtonElement
    expect(btn.disabled).toBe(true)

    resolveDel({})
    await waitFor(() => expect(screen.getByText(en.admin.deleteImage)).toBeTruthy())
  })
})
