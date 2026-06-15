// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { CategoryTree } from './CategoryTree'
import { en } from '@/lib/i18n/en'
import type { CategoryNode } from '@/lib/types/category'
import type { ListNavController } from '@/lib/types/shortcuts'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

// Capture the registered controller so tests can call it directly
let capturedController: ListNavController | null = null
vi.mock('@/components/admin/shared/ListNavContext', () => ({
  useRegisterListNav: (ctrl: ListNavController) => {
    capturedController = ctrl
  },
}))

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
  capturedController = null
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

  it('registers a list-nav controller', () => {
    render(
      <CategoryTree
        categories={[makeNode()]}
        onReorder={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    expect(capturedController).not.toBeNull()
    expect(typeof capturedController?.next).toBe('function')
    expect(typeof capturedController?.prev).toBe('function')
    expect(typeof capturedController?.open).toBe('function')
  })

  it('next() applies the active highlight to the first node', () => {
    const node = makeNode({ id: 'nav1', name: 'Nav Node' })
    const { container } = render(
      <CategoryTree categories={[node]} onReorder={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />,
    )
    // The node div is inside the flex container — find by text proximity
    const nodeDiv = container.querySelector('[style]') // depth=0 has marginLeft:0
    expect(nodeDiv?.className).not.toContain('ring-1')
    act(() => {
      capturedController?.next()
    })
    expect(nodeDiv?.className).toContain('ring-1')
  })

  it('open() navigates to the category detail page', () => {
    const node = makeNode({ id: 'cat-42', name: 'Open Me' })
    render(
      <CategoryTree categories={[node]} onReorder={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />,
    )
    act(() => {
      capturedController?.next()
    })
    act(() => {
      capturedController?.open()
    })
    expect(mockPush).toHaveBeenCalledWith('/admin/categories/cat-42')
  })

  it('j/k traverses flattened tree depth-first (parent then child)', () => {
    const tree = makeNode({
      id: 'root',
      name: 'Root',
      children: [makeNode({ id: 'leaf', name: 'Leaf', parentId: 'root' })],
    })
    render(
      <CategoryTree categories={[tree]} onReorder={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />,
    )
    // First next() → root is active; second next() → leaf is active
    act(() => {
      capturedController?.next()
    })
    act(() => {
      capturedController?.open()
    })
    expect(mockPush).toHaveBeenLastCalledWith('/admin/categories/root')

    act(() => {
      capturedController?.next()
    })
    act(() => {
      capturedController?.open()
    })
    expect(mockPush).toHaveBeenLastCalledWith('/admin/categories/leaf')
  })
})
