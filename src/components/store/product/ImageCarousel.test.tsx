// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import { ImageCarousel } from './ImageCarousel'
import type { ProductImage } from '@/lib/types/product'

vi.mock('next/image', async () => {
  const { createElement } = await import('react')
  return {
    default: (
      props: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean },
    ) => {
      const { fill, priority, ...rest } = props
      return createElement('img', rest)
    },
  }
})

// Capture the api consumer (setApi) so we can drive embla events from the test.
const scrollTo = vi.fn()
const on = vi.fn()
const off = vi.fn()
const selectedScrollSnap = vi.fn(() => 1)
let capturedSetApi: ((api: unknown) => void) | undefined

vi.mock('@/components/ui/carousel', async () => {
  const { createElement } = await import('react')
  return {
    Carousel: ({
      setApi,
      children,
    }: {
      setApi?: (a: unknown) => void
      children: React.ReactNode
    }) => {
      capturedSetApi = setApi
      return createElement('div', { 'data-testid': 'carousel' }, children)
    },
    CarouselContent: ({ children }: { children: React.ReactNode }) =>
      createElement('div', null, children),
    CarouselItem: ({ children }: { children: React.ReactNode }) =>
      createElement('div', null, children),
    CarouselPrevious: (props: Record<string, unknown>) =>
      createElement('button', { ...props, 'data-testid': 'prev' }, 'prev'),
    CarouselNext: (props: Record<string, unknown>) =>
      createElement('button', { ...props, 'data-testid': 'next' }, 'next'),
  }
})

function makeImage(id: string, url = `/img/${id}.jpg`): ProductImage {
  return { id, variantId: 'v1', url, sortOrder: 0, r2Key: `variants/v1/${id}.jpg` } as ProductImage
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  capturedSetApi = undefined
})

describe('ImageCarousel', () => {
  it('renders the empty-state placeholder when there are no images', () => {
    render(<ImageCarousel images={[]} />)
    expect(screen.getByText('No image')).toBeTruthy()
  })

  it('applies className to the empty state', () => {
    const { container } = render(<ImageCarousel images={[]} className="empty-cls" />)
    expect((container.firstChild as HTMLElement).className).toContain('empty-cls')
  })

  it('renders one image and no nav/thumbnails for a single image', () => {
    render(<ImageCarousel images={[makeImage('a')]} />)
    expect(screen.getByAltText('Product image 1')).toBeTruthy()
    expect(screen.queryByTestId('prev')).toBeNull()
    expect(screen.queryByTestId('next')).toBeNull()
    // No thumbnail buttons
    expect(screen.queryByAltText('Thumbnail 1')).toBeNull()
  })

  it('renders nav buttons and a thumbnail strip for multiple images', () => {
    render(<ImageCarousel images={[makeImage('a'), makeImage('b')]} />)
    expect(screen.getByTestId('prev')).toBeTruthy()
    expect(screen.getByTestId('next')).toBeTruthy()
    expect(screen.getByAltText('Thumbnail 1')).toBeTruthy()
    expect(screen.getByAltText('Thumbnail 2')).toBeTruthy()
  })

  it('clicking a thumbnail calls api.scrollTo with its index (after api is set)', () => {
    render(<ImageCarousel images={[makeImage('a'), makeImage('b')]} />)
    // Drive the effect by providing an api object
    const api = { on, off, scrollTo, selectedScrollSnap }
    act(() => capturedSetApi?.(api))
    const thumb2 = screen.getByAltText('Thumbnail 2').closest('button')!
    fireEvent.click(thumb2)
    expect(scrollTo).toHaveBeenCalledWith(1)
  })

  it('subscribes to select/reInit and updates current via selectedScrollSnap', () => {
    render(<ImageCarousel images={[makeImage('a'), makeImage('b')]} />)
    const api = { on, off, scrollTo, selectedScrollSnap }
    act(() => capturedSetApi?.(api))
    // on() was called for 'select' and 'reInit'
    const events = on.mock.calls.map((c) => c[0])
    expect(events).toContain('select')
    expect(events).toContain('reInit')
    // Fire the registered select handler — current becomes 1 → 2nd thumb selected
    const selectHandler = on.mock.calls.find((c) => c[0] === 'select')![1] as () => void
    act(() => selectHandler())
    // selectedScrollSnap returns 1, so thumb index 1 should carry border-primary
    const thumb2 = screen.getByAltText('Thumbnail 2').closest('button')!
    expect(thumb2.className).toContain('border-primary')
  })

  it('does nothing in the effect when api is undefined', () => {
    render(<ImageCarousel images={[makeImage('a'), makeImage('b')]} />)
    // setApi never called with a real api → on() not invoked
    expect(on).not.toHaveBeenCalled()
  })
})
