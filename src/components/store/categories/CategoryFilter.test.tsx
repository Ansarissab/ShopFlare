// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { CategoryFilter } from './CategoryFilter'
import { en } from '@/lib/i18n/en'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const categories = [
  { id: 'cat-1', name: 'Tops', slug: 'tops', parentId: null, sortOrder: 0, imageUrl: null, productCount: 3, children: [] },
  { id: 'cat-2', name: 'Bottoms', slug: 'bottoms', parentId: null, sortOrder: 1, imageUrl: null, productCount: 2, children: [] },
]

describe('CategoryFilter', () => {
  it('renders nothing when categories array is empty', () => {
    const { container } = render(
      <CategoryFilter categories={[]} activeSlug={null} onChange={vi.fn()} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders All Products chip', () => {
    render(<CategoryFilter categories={categories} activeSlug={null} onChange={vi.fn()} />)
    expect(screen.getByText(en.store.allProducts)).toBeTruthy()
  })

  it('renders category names', () => {
    render(<CategoryFilter categories={categories} activeSlug={null} onChange={vi.fn()} />)
    expect(screen.getByText('Tops')).toBeTruthy()
    expect(screen.getByText('Bottoms')).toBeTruthy()
  })

  it('clicking a category chip calls onChange with that slug', () => {
    const onChange = vi.fn()
    render(<CategoryFilter categories={categories} activeSlug={null} onChange={onChange} />)
    fireEvent.click(screen.getByText('Tops'))
    expect(onChange).toHaveBeenCalledWith('tops')
  })

  it('clicking All Products calls onChange with null', () => {
    const onChange = vi.fn()
    render(<CategoryFilter categories={categories} activeSlug="tops" onChange={onChange} />)
    fireEvent.click(screen.getByText(en.store.allProducts))
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('clicking a second category calls onChange with its slug', () => {
    const onChange = vi.fn()
    render(<CategoryFilter categories={categories} activeSlug="tops" onChange={onChange} />)
    fireEvent.click(screen.getByText('Bottoms'))
    expect(onChange).toHaveBeenCalledWith('bottoms')
  })
})
