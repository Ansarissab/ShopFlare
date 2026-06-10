// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { SizePicker } from './SizePicker'
import { en } from '@/lib/i18n/en'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const activeSizes = [
  {
    id: 'sz-s',
    size: 'S',
    priceCents: 1500,
    stock: 10,
    active: true,
    variantId: 'v1',
    sortOrder: 0,
    sku: null,
    stripePriceId: null,
  },
  {
    id: 'sz-m',
    size: 'M',
    priceCents: 1500,
    stock: 5,
    active: true,
    variantId: 'v1',
    sortOrder: 1,
    sku: null,
    stripePriceId: null,
  },
  {
    id: 'sz-l',
    size: 'L',
    priceCents: 1500,
    stock: 0,
    active: true,
    variantId: 'v1',
    sortOrder: 2,
    sku: null,
    stripePriceId: null,
  },
  {
    id: 'sz-xl',
    size: 'XL',
    priceCents: 2000,
    stock: 3,
    active: false,
    variantId: 'v1',
    sortOrder: 3,
    sku: null,
    stripePriceId: null,
  },
]

describe('SizePicker', () => {
  it('renders nothing when sizes array is empty', () => {
    const { container } = render(<SizePicker sizes={[]} selectedSizeId={null} onSelect={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders label and active size buttons', () => {
    render(<SizePicker sizes={activeSizes} selectedSizeId={null} onSelect={vi.fn()} />)
    expect(screen.getByText(en.store.selectSize)).toBeTruthy()
    expect(screen.getByText('S')).toBeTruthy()
    expect(screen.getByText('M')).toBeTruthy()
    expect(screen.getByText('L')).toBeTruthy()
  })

  it('does not render inactive sizes', () => {
    render(<SizePicker sizes={activeSizes} selectedSizeId={null} onSelect={vi.fn()} />)
    expect(screen.queryByText('XL')).toBeNull()
  })

  it('calls onSelect with size id when in-stock size is clicked', () => {
    const onSelect = vi.fn()
    render(<SizePicker sizes={activeSizes} selectedSizeId={null} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('S').closest('button')!)
    expect(onSelect).toHaveBeenCalledWith('sz-s')
  })

  it('does not call onSelect when out-of-stock size is clicked', () => {
    const onSelect = vi.fn()
    render(<SizePicker sizes={activeSizes} selectedSizeId={null} onSelect={onSelect} />)
    const oosBtnParent = screen.getByText('L').closest('button')!
    fireEvent.click(oosBtnParent)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('selected size has aria-pressed=true', () => {
    render(<SizePicker sizes={activeSizes} selectedSizeId="sz-m" onSelect={vi.fn()} />)
    const mBtn = screen.getByText('M').closest('button')!
    expect(mBtn.getAttribute('aria-pressed')).toBe('true')
  })

  it('non-selected sizes have aria-pressed=false', () => {
    render(<SizePicker sizes={activeSizes} selectedSizeId="sz-m" onSelect={vi.fn()} />)
    const sBtn = screen.getByText('S').closest('button')!
    expect(sBtn.getAttribute('aria-pressed')).toBe('false')
  })

  it('shows out-of-stock badge for zero-stock size', () => {
    render(<SizePicker sizes={activeSizes} selectedSizeId={null} onSelect={vi.fn()} />)
    expect(screen.getByText(en.store.outOfStock)).toBeTruthy()
  })

  it('shows low stock badge for sizes at or below threshold', () => {
    render(<SizePicker sizes={activeSizes} selectedSizeId={null} onSelect={vi.fn()} />)
    // stock=5 triggers LOW_STOCK_THRESHOLD badge
    expect(screen.getByText(en.store.lowStock.replace('{count}', '5'))).toBeTruthy()
  })
})
