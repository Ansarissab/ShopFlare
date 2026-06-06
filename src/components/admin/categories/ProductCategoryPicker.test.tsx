// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ProductCategoryPicker } from './ProductCategoryPicker'
import { en } from '@/lib/i18n/en'
import type { CategoryNode } from '@/lib/types/category'

const mockUseApiResource = vi.fn()
vi.mock('@/hooks/useApiResource', () => ({
  useApiResource: (...args: unknown[]) => mockUseApiResource(...args),
}))

function makeCategory(over: Partial<CategoryNode> = {}): CategoryNode {
  return {
    id: 'c1',
    name: 'Parent',
    slug: 'parent',
    description: '',
    parentId: null,
    imageUrl: null,
    r2Key: null,
    sortOrder: 0,
    active: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    productCount: 0,
    children: [],
    ...over,
  }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ProductCategoryPicker', () => {
  it('renders the loading state', () => {
    mockUseApiResource.mockReturnValue({ data: null, loading: true })
    render(<ProductCategoryPicker selectedIds={[]} onChange={vi.fn()} />)
    expect(screen.getByText('Loading…')).toBeTruthy()
  })

  it('renders empty state when there are no categories', () => {
    mockUseApiResource.mockReturnValue({ data: { categories: [] }, loading: false })
    render(<ProductCategoryPicker selectedIds={[]} onChange={vi.fn()} />)
    expect(screen.getByText(en.admin.noCategories)).toBeTruthy()
  })

  it('renders empty state when data is undefined (nullish coalesce branch)', () => {
    mockUseApiResource.mockReturnValue({ data: undefined, loading: false })
    render(<ProductCategoryPicker selectedIds={[]} onChange={vi.fn()} />)
    expect(screen.getByText(en.admin.noCategories)).toBeTruthy()
  })

  it('renders parent and indented child rows', () => {
    const cat = makeCategory({
      id: 'p1',
      name: 'Apparel',
      children: [makeCategory({ id: 'ch1', name: 'Shirts', parentId: 'p1' })],
    })
    mockUseApiResource.mockReturnValue({ data: { categories: [cat] }, loading: false })
    render(<ProductCategoryPicker selectedIds={[]} onChange={vi.fn()} />)
    expect(screen.getByText('Apparel')).toBeTruthy()
    expect(screen.getByText('Apparel › Shirts')).toBeTruthy()
  })

  it('reflects checked state from selectedIds', () => {
    const cat = makeCategory({ id: 'p1', name: 'Apparel' })
    mockUseApiResource.mockReturnValue({ data: { categories: [cat] }, loading: false })
    render(<ProductCategoryPicker selectedIds={['p1']} onChange={vi.fn()} />)
    const cb = document.getElementById('cat-p1') as HTMLInputElement
    expect(cb.checked).toBe(true)
  })

  it('toggle adds an id when not selected', () => {
    const onChange = vi.fn()
    const cat = makeCategory({ id: 'p1', name: 'Apparel' })
    mockUseApiResource.mockReturnValue({ data: { categories: [cat] }, loading: false })
    render(<ProductCategoryPicker selectedIds={[]} onChange={onChange} />)
    fireEvent.click(document.getElementById('cat-p1') as HTMLElement)
    expect(onChange).toHaveBeenCalledWith(['p1'])
  })

  it('toggle removes an id when already selected', () => {
    const onChange = vi.fn()
    const cat = makeCategory({
      id: 'p1',
      name: 'Apparel',
      children: [makeCategory({ id: 'ch1', name: 'Shirts', parentId: 'p1' })],
    })
    mockUseApiResource.mockReturnValue({ data: { categories: [cat] }, loading: false })
    render(<ProductCategoryPicker selectedIds={['p1', 'ch1']} onChange={onChange} />)
    // toggle off the child
    fireEvent.click(document.getElementById('cat-ch1') as HTMLElement)
    expect(onChange).toHaveBeenCalledWith(['p1'])
  })

  it('requests the categories endpoint', () => {
    mockUseApiResource.mockReturnValue({ data: { categories: [] }, loading: false })
    render(<ProductCategoryPicker selectedIds={[]} onChange={vi.fn()} />)
    expect(mockUseApiResource).toHaveBeenCalledWith('/api/categories')
  })
})
