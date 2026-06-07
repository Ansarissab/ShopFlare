// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { CartItem } from './CartItem'
import { en } from '@/lib/i18n/en'

vi.mock('next/image', async () => {
  const { createElement } = await import('react')
  return {
    default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => {
      const { fill, priority, ...rest } = props
      return createElement('img', rest)
    },
  }
})

const updateQuantity = vi.fn()
const removeItem = vi.fn()

vi.mock('@/hooks/useCart', () => ({
  useCart: () => ({ updateQuantity, removeItem }),
}))

const baseItem = {
  sizeOptionId: 'size-1',
  productId: 'prod-1',
  variantId: 'var-1',
  productName: 'Blue Hoodie',
  variantLabel: 'Blue',
  size: 'M',
  priceCents: 2500,
  imageUrl: '/images/hoodie.jpg',
  quantity: 2,
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('CartItem', () => {
  it('renders product name and variant/size label', () => {
    render(<CartItem item={baseItem} />)
    expect(screen.getByText('Blue Hoodie')).toBeTruthy()
    expect(screen.getByText('Blue / M')).toBeTruthy()
  })

  it('renders the correct quantity', () => {
    render(<CartItem item={baseItem} />)
    expect(screen.getByText('2')).toBeTruthy()
  })

  it('renders computed line price (priceCents × quantity)', () => {
    render(<CartItem item={baseItem} />)
    // 2500 × 2 = 5000 cents = ₨5,000 (PKR default, 0 decimals)
    expect(screen.getByText('₨5,000')).toBeTruthy()
  })

  it('remove button calls removeItem with sizeOptionId', () => {
    render(<CartItem item={baseItem} />)
    fireEvent.click(screen.getByLabelText(en.cart.remove))
    expect(removeItem).toHaveBeenCalledWith('size-1')
  })

  it('minus button calls updateQuantity with qty - 1', () => {
    render(<CartItem item={baseItem} />)
    fireEvent.click(screen.getByLabelText(`${en.cart.quantity} -1`))
    expect(updateQuantity).toHaveBeenCalledWith('size-1', 1)
  })

  it('plus button calls updateQuantity with qty + 1', () => {
    render(<CartItem item={baseItem} />)
    fireEvent.click(screen.getByLabelText(`${en.cart.quantity} +1`))
    expect(updateQuantity).toHaveBeenCalledWith('size-1', 3)
  })

  it('renders SKU when present', () => {
    render(<CartItem item={{ ...baseItem, sku: 'SKU-99' }} />)
    expect(screen.getByText('SKU: SKU-99')).toBeTruthy()
  })

  it('does not render SKU line when absent', () => {
    render(<CartItem item={baseItem} />)
    expect(screen.queryByText(/SKU:/)).toBeNull()
  })
})
