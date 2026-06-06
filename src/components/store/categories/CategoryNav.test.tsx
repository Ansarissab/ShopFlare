// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { CategoryNav } from './CategoryNav'
import { en } from '@/lib/i18n/en'
import type { CategoryNode } from '@/lib/types/category'

vi.mock('next/link', async () => {
  const { createElement } = await import('react')
  return {
    default: ({
      href,
      children,
      onClick,
      className,
    }: {
      href: string
      children: React.ReactNode
      onClick?: (e: React.MouseEvent) => void
      className?: string
    }) => createElement('a', { href, onClick, className }, children),
  }
})

vi.mock('lucide-react', async () => {
  const { createElement } = await import('react')
  const icon = (testid: string) => (props: Record<string, unknown>) =>
    createElement('span', { 'data-testid': testid, ...props })
  return {
    ChevronDown: icon('chevron'),
    ChevronRightIcon: icon('chevron-right'),
    CheckIcon: icon('check'),
  }
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function cat(over: Partial<CategoryNode> & Pick<CategoryNode, 'id' | 'name' | 'slug'>): CategoryNode {
  return {
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

describe('CategoryNav', () => {
  it('renders nothing when categories is empty', () => {
    const { container } = render(<CategoryNav categories={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the trigger with the browse-categories label and chevron', () => {
    render(<CategoryNav categories={[cat({ id: '1', name: 'Shoes', slug: 'shoes' })]} />)
    expect(screen.getByText(en.store.browseCategories)).toBeTruthy()
    expect(screen.getByTestId('chevron')).toBeTruthy()
  })

  // base-ui menus open via a portal; give these interaction tests extra headroom
  // so they don't flake when the jsdom pool is CPU-starved (e.g. running alongside
  // the miniflare integration pool).
  it('opens the menu and renders a flat (no-children) category as a single link', async () => {
    render(<CategoryNav categories={[cat({ id: '1', name: 'Shoes', slug: 'shoes' })]} />)
    fireEvent.click(screen.getByText(en.store.browseCategories))
    const link = await screen.findByText('Shoes')
    expect(link.getAttribute('href')).toBe('/category/shoes')
  }, 15000)

  it('renders a parent with children as a submenu sub-trigger (parent link)', async () => {
    const categories = [
      cat({
        id: 'p1',
        name: 'Apparel',
        slug: 'apparel',
        children: [
          cat({ id: 'c1', name: 'Shirts', slug: 'shirts', parentId: 'p1' }),
          cat({ id: 'c2', name: 'Pants', slug: 'pants', parentId: 'p1' }),
        ],
      }),
    ]
    render(<CategoryNav categories={categories} />)
    fireEvent.click(screen.getByText(en.store.browseCategories))

    // The parent renders as a sub-trigger link pointing at the parent category.
    const parentTriggerLinks = await screen.findAllByText('Apparel')
    expect(parentTriggerLinks.length).toBeGreaterThanOrEqual(1)
    const parentLink = parentTriggerLinks.find((el) => el.getAttribute('href') === '/category/apparel')
    expect(parentLink).toBeTruthy()
  }, 15000)

  it('parent sub-trigger link stops click propagation', async () => {
    const categories = [
      cat({
        id: 'p1',
        name: 'Apparel',
        slug: 'apparel',
        children: [cat({ id: 'c1', name: 'Shirts', slug: 'shirts', parentId: 'p1' })],
      }),
    ]
    render(<CategoryNav categories={categories} />)
    fireEvent.click(screen.getByText(en.store.browseCategories))

    const links = await screen.findAllByText('Apparel')
    // The sub-trigger link has onClick stopPropagation; clicking it should not throw.
    const stopSpy = vi.fn()
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true })
    ev.stopPropagation = stopSpy
    links[0].dispatchEvent(ev)
    expect(stopSpy).toHaveBeenCalled()
  }, 15000)

  it('renders mixed flat + submenu categories', async () => {
    const categories = [
      cat({ id: 'flat', name: 'Sale', slug: 'sale' }),
      cat({
        id: 'p1',
        name: 'Apparel',
        slug: 'apparel',
        children: [cat({ id: 'c1', name: 'Shirts', slug: 'shirts', parentId: 'p1' })],
      }),
    ]
    render(<CategoryNav categories={categories} />)
    fireEvent.click(screen.getByText(en.store.browseCategories))

    expect(await screen.findByText('Sale')).toBeTruthy()
    expect(screen.getAllByText('Apparel').length).toBeGreaterThanOrEqual(1)
  }, 15000)
})
