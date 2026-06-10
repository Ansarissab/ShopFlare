// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { CategoryTree } from './CategoryTree'
import { en } from '@/lib/i18n/en'
import type { CategoryNode } from '@/lib/types/category'

function makeNode(over: Partial<CategoryNode> = {}): CategoryNode {
  return {
    id: 'n1',
    name: 'Node',
    slug: 'node',
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

describe('CategoryTree', () => {
  it('renders empty state when no categories', () => {
    render(<CategoryTree categories={[]} onReorder={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText(en.admin.noCategories)).toBeTruthy()
  })

  it('renders active badge and singular product label', () => {
    const node = makeNode({ name: 'Shoes', active: true, productCount: 1 })
    render(
      <CategoryTree categories={[node]} onReorder={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />,
    )
    expect(screen.getByText('Shoes')).toBeTruthy()
    expect(screen.getByText(en.admin.active)).toBeTruthy()
    expect(screen.getByText('1 product')).toBeTruthy()
  })

  it('renders inactive badge and plural product label', () => {
    const node = makeNode({ name: 'Hats', active: false, productCount: 3 })
    render(
      <CategoryTree categories={[node]} onReorder={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />,
    )
    expect(screen.getByText(en.admin.inactive)).toBeTruthy()
    expect(screen.getByText('3 products')).toBeTruthy()
  })

  it('renders zero products as plural', () => {
    const node = makeNode({ productCount: 0 })
    render(
      <CategoryTree categories={[node]} onReorder={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />,
    )
    expect(screen.getByText('0 products')).toBeTruthy()
  })

  it('fires onReorder up/down', () => {
    const onReorder = vi.fn()
    const node = makeNode({ id: 'x1' })
    render(
      <CategoryTree
        categories={[node]}
        onReorder={onReorder}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByLabelText('Move up'))
    expect(onReorder).toHaveBeenCalledWith('x1', 'up')
    fireEvent.click(screen.getByLabelText('Move down'))
    expect(onReorder).toHaveBeenCalledWith('x1', 'down')
  })

  it('fires onEdit with the node', () => {
    const onEdit = vi.fn()
    const node = makeNode({ id: 'x2', name: 'Bags' })
    render(
      <CategoryTree categories={[node]} onReorder={vi.fn()} onEdit={onEdit} onDelete={vi.fn()} />,
    )
    fireEvent.click(screen.getByLabelText(en.admin.editCategory))
    expect(onEdit).toHaveBeenCalledWith(node)
  })

  it('fires onDelete with the node id', () => {
    const onDelete = vi.fn()
    const node = makeNode({ id: 'x3' })
    render(
      <CategoryTree categories={[node]} onReorder={vi.fn()} onEdit={vi.fn()} onDelete={onDelete} />,
    )
    fireEvent.click(screen.getByLabelText(en.admin.deleteCategory))
    expect(onDelete).toHaveBeenCalledWith('x3')
  })

  it('renders nested children recursively', () => {
    const tree = makeNode({
      id: 'p',
      name: 'Parent',
      children: [
        makeNode({
          id: 'c',
          name: 'Child',
          parentId: 'p',
          children: [makeNode({ id: 'g', name: 'Grandchild', parentId: 'c' })],
        }),
      ],
    })
    render(
      <CategoryTree categories={[tree]} onReorder={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />,
    )
    expect(screen.getByText('Parent')).toBeTruthy()
    expect(screen.getByText('Child')).toBeTruthy()
    expect(screen.getByText('Grandchild')).toBeTruthy()
  })
})
