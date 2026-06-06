// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { OrderLineItem } from './OrderLineItem'
import { en } from '@/lib/i18n/en'
import { formatPrice } from '@/lib/utils/index'

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

const baseProps = {
  imageUrl: '/images/hoodie.jpg',
  productName: 'Blue Hoodie',
  variantLabel: 'Blue',
  size: 'M',
  quantity: 2,
  priceCents: 2500,
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('OrderLineItem', () => {
  it('renders the product name', () => {
    render(<OrderLineItem {...baseProps} />)
    expect(screen.getByText('Blue Hoodie')).toBeTruthy()
  })

  it('renders the variant and size joined by a separator', () => {
    render(<OrderLineItem {...baseProps} />)
    expect(screen.getByText('Blue · M')).toBeTruthy()
  })

  it('renders the quantity with the localized label', () => {
    render(<OrderLineItem {...baseProps} />)
    expect(screen.getByText(`${en.cart.quantity}: 2`)).toBeTruthy()
  })

  it('renders the line total as priceCents × quantity', () => {
    render(<OrderLineItem {...baseProps} />)
    expect(screen.getByText(formatPrice(2500 * 2))).toBeTruthy()
  })

  it('renders an image with src and alt when imageUrl is present', () => {
    render(<OrderLineItem {...baseProps} />)
    const img = screen.getByAltText('Blue Hoodie') as HTMLImageElement
    expect(img).toBeTruthy()
    expect(img.getAttribute('src')).toBe('/images/hoodie.jpg')
  })

  it('renders a placeholder div (no image) when imageUrl is null', () => {
    render(<OrderLineItem {...baseProps} imageUrl={null} />)
    expect(screen.queryByAltText('Blue Hoodie')).toBeNull()
    // placeholder div present
    expect(document.querySelector('.size-16.bg-muted')).toBeTruthy()
  })

  it('renders a placeholder div when imageUrl is undefined', () => {
    const { imageUrl, ...rest } = baseProps
    render(<OrderLineItem {...rest} />)
    expect(screen.queryByAltText('Blue Hoodie')).toBeNull()
  })

  it('computes line total correctly for quantity of 1', () => {
    render(<OrderLineItem {...baseProps} quantity={1} priceCents={999} />)
    expect(screen.getByText(formatPrice(999))).toBeTruthy()
  })
})
