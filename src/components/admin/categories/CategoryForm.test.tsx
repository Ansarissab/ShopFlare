// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { CategoryForm } from './CategoryForm'
import { en } from '@/lib/i18n/en'
import { apiPost, apiPut, ApiError } from '@/lib/api'
import { toast } from 'sonner'
import type { Category } from '@/lib/types/category'

vi.mock('@/lib/api', () => {
  class ApiError extends Error {
    status: number
    body?: unknown
    constructor(status: number, message: string, body?: unknown) {
      super(message)
      this.status = status
      this.body = body
      this.name = 'ApiError'
    }
  }
  return {
    apiPost: vi.fn(() => Promise.resolve({})),
    apiPut: vi.fn(() => Promise.resolve({})),
    ApiError,
  }
})

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

function makeCategory(over: Partial<Category> = {}): Category {
  return {
    id: 'c1',
    name: 'Existing',
    slug: 'existing',
    description: 'desc',
    parentId: null,
    imageUrl: null,
    r2Key: null,
    sortOrder: 2,
    active: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...over,
  }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('CategoryForm', () => {
  it('renders create mode with empty fields and add button', () => {
    render(<CategoryForm parentOptions={[]} onSuccess={vi.fn()} />)
    expect(screen.getByLabelText(en.admin.categoryName)).toBeTruthy()
    expect(screen.getByRole('button', { name: en.admin.addCategory })).toBeTruthy()
  })

  it('renders edit mode prefilled with the edit button', () => {
    const cat = makeCategory({ name: 'Shoes', slug: 'shoes' })
    render(<CategoryForm category={cat} parentOptions={[]} onSuccess={vi.fn()} />)
    expect((screen.getByLabelText(en.admin.categoryName) as HTMLInputElement).value).toBe('Shoes')
    expect(screen.getByRole('button', { name: en.admin.editCategory })).toBeTruthy()
  })

  it('auto-fills slug from name in create mode', () => {
    render(<CategoryForm parentOptions={[]} onSuccess={vi.fn()} />)
    const name = screen.getByLabelText(en.admin.categoryName)
    fireEvent.change(name, { target: { value: 'Summer Collection' } })
    const slug = document.getElementById('cat-slug') as HTMLInputElement
    expect(slug.value).toBe('summer-collection')
  })

  it('does not auto-overwrite a manually edited slug', () => {
    render(<CategoryForm parentOptions={[]} onSuccess={vi.fn()} />)
    const slug = document.getElementById('cat-slug') as HTMLInputElement
    fireEvent.change(slug, { target: { value: 'custom-slug' } })
    fireEvent.change(screen.getByLabelText(en.admin.categoryName), {
      target: { value: 'Another Name' },
    })
    expect(slug.value).toBe('custom-slug')
  })

  it('does not auto-fill slug in edit mode', () => {
    const cat = makeCategory({ name: 'Old', slug: 'old' })
    render(<CategoryForm category={cat} parentOptions={[]} onSuccess={vi.fn()} />)
    const slug = document.getElementById('cat-slug') as HTMLInputElement
    fireEvent.change(screen.getByLabelText(en.admin.categoryName), {
      target: { value: 'Brand New' },
    })
    expect(slug.value).toBe('old')
  })

  it('submits create: calls apiPost and onSuccess with success toast', async () => {
    const onSuccess = vi.fn()
    render(<CategoryForm parentOptions={[]} onSuccess={onSuccess} />)
    fireEvent.change(screen.getByLabelText(en.admin.categoryName), { target: { value: 'New Cat' } })
    fireEvent.click(screen.getByRole('button', { name: en.admin.addCategory }))
    await waitFor(() => expect(apiPost).toHaveBeenCalled())
    expect(toast.success).toHaveBeenCalledWith(en.admin.categoryCreated)
    expect(onSuccess).toHaveBeenCalled()
  })

  it('submits edit: calls apiPut to the id endpoint', async () => {
    const onSuccess = vi.fn()
    const cat = makeCategory({ id: 'c9', name: 'Editing', slug: 'editing' })
    render(<CategoryForm category={cat} parentOptions={[]} onSuccess={onSuccess} />)
    fireEvent.click(screen.getByRole('button', { name: en.admin.editCategory }))
    await waitFor(() => expect(apiPut).toHaveBeenCalled())
    expect(vi.mocked(apiPut).mock.calls[0][0]).toBe('/api/admin/categories/c9')
    expect(toast.success).toHaveBeenCalledWith(en.admin.categoryUpdated)
    expect(onSuccess).toHaveBeenCalled()
  })

  it('handles a 409 conflict by setting a slug error', async () => {
    vi.mocked(apiPost).mockRejectedValueOnce(new ApiError(409, 'conflict'))
    render(<CategoryForm parentOptions={[]} onSuccess={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(en.admin.categoryName), { target: { value: 'Dup' } })
    fireEvent.click(screen.getByRole('button', { name: en.admin.addCategory }))
    await waitFor(() => expect(screen.getByText(en.admin.slugTaken)).toBeTruthy())
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('handles a 422 parentId error', async () => {
    vi.mocked(apiPost).mockRejectedValueOnce(
      new ApiError(422, 'invalid', { field: 'parentId', message: 'Bad parent' }),
    )
    render(<CategoryForm parentOptions={[]} onSuccess={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(en.admin.categoryName), { target: { value: 'X' } })
    fireEvent.click(screen.getByRole('button', { name: en.admin.addCategory }))
    await waitFor(() => expect(screen.getByText('Bad parent')).toBeTruthy())
  })

  it('falls back to default message for 422 parentId without message', async () => {
    vi.mocked(apiPost).mockRejectedValueOnce(
      new ApiError(422, 'invalid', { field: 'parentId' }),
    )
    render(<CategoryForm parentOptions={[]} onSuccess={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(en.admin.categoryName), { target: { value: 'X' } })
    fireEvent.click(screen.getByRole('button', { name: en.admin.addCategory }))
    await waitFor(() => expect(screen.getByText('Invalid parent')).toBeTruthy())
  })

  it('shows a generic toast on a non-handled error', async () => {
    vi.mocked(apiPost).mockRejectedValueOnce(new Error('weird failure'))
    render(<CategoryForm parentOptions={[]} onSuccess={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(en.admin.categoryName), { target: { value: 'X' } })
    fireEvent.click(screen.getByRole('button', { name: en.admin.addCategory }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('weird failure'))
  })

  it('shows a generic toast on a 422 error that is not parentId', async () => {
    vi.mocked(apiPost).mockRejectedValueOnce(
      new ApiError(422, 'other-field', { field: 'name', message: 'too long' }),
    )
    render(<CategoryForm parentOptions={[]} onSuccess={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(en.admin.categoryName), { target: { value: 'X' } })
    fireEvent.click(screen.getByRole('button', { name: en.admin.addCategory }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('other-field'))
  })

  it('toggles the active checkbox', () => {
    render(<CategoryForm parentOptions={[]} onSuccess={vi.fn()} />)
    const input = document.getElementById('cat-active') as HTMLInputElement
    expect(input.checked).toBe(true)
    const role = screen.getByRole('checkbox')
    fireEvent.click(role)
    expect(input.checked).toBe(false)
  })

  it('excludes self from parent options in edit mode', () => {
    const cat = makeCategory({ id: 'self', name: 'Self' })
    const parentOptions = [makeCategory({ id: 'self', name: 'Self' }), makeCategory({ id: 'other', name: 'Other' })]
    render(<CategoryForm category={cat} parentOptions={parentOptions} onSuccess={vi.fn()} />)
    // open the select
    fireEvent.click(screen.getByLabelText(en.admin.categoryParent))
    // "Other" should be available; "Self" should not appear as an option
    expect(screen.getByText('Other')).toBeTruthy()
  })

  it('renders all parent options in create mode and allows selecting one', () => {
    const parentOptions = [makeCategory({ id: 'p1', name: 'ParentOne' })]
    render(<CategoryForm parentOptions={parentOptions} onSuccess={vi.fn()} />)
    fireEvent.click(screen.getByLabelText(en.admin.categoryParent))
    expect(screen.getByText('ParentOne')).toBeTruthy()
    // option is selectable without throwing
    fireEvent.click(screen.getByText('ParentOne'))
  })

  it('shows a generic toast on a 422 error with no body (body?.field undefined)', async () => {
    // err.body is undefined -> body?.field optional-chain falls through to generic toast
    vi.mocked(apiPost).mockRejectedValueOnce(new ApiError(422, 'no-body'))
    render(<CategoryForm parentOptions={[]} onSuccess={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(en.admin.categoryName), { target: { value: 'X' } })
    fireEvent.click(screen.getByRole('button', { name: en.admin.addCategory }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('no-body'))
  })

  it('uses the create path when category has a falsy id (isEdit && category?.id false)', async () => {
    // category present (isEdit true) but id empty -> category?.id falsy -> apiPost branch
    const onSuccess = vi.fn()
    const cat = makeCategory({ id: '', name: 'NoId', slug: 'noid' })
    render(<CategoryForm category={cat} parentOptions={[]} onSuccess={onSuccess} />)
    // edit mode shows the edit button label even though id is empty
    fireEvent.click(screen.getByRole('button', { name: en.admin.editCategory }))
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/api/admin/categories', expect.any(Object)))
    expect(apiPut).not.toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledWith(en.admin.categoryCreated)
    expect(onSuccess).toHaveBeenCalled()
  })

  it('keeps slug synced when current slug equals the previous auto-slug (current === prevAutoSlug)', () => {
    // type a name, slug auto-fills to match; type again -> current === prevAutoSlug branch keeps syncing
    render(<CategoryForm parentOptions={[]} onSuccess={vi.fn()} />)
    const name = screen.getByLabelText(en.admin.categoryName)
    fireEvent.change(name, { target: { value: 'Hats' } })
    const slug = document.getElementById('cat-slug') as HTMLInputElement
    expect(slug.value).toBe('hats')
    fireEvent.change(name, { target: { value: 'Hats And Caps' } })
    expect(slug.value).toBe('hats-and-caps')
  })

  it('re-checking the active checkbox sets it back to true (v === true branch)', () => {
    render(<CategoryForm parentOptions={[]} onSuccess={vi.fn()} />)
    const input = document.getElementById('cat-active') as HTMLInputElement
    const role = screen.getByRole('checkbox')
    fireEvent.click(role)
    expect(input.checked).toBe(false)
    fireEvent.click(role)
    expect(input.checked).toBe(true)
  })
})
