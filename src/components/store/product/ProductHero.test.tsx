// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { ProductHero } from './ProductHero'
import { en } from '@/lib/i18n/en'
import type {
  ProductHeroProps,
  SizeOption,
  Variant,
  ProductImage,
  Product,
} from '@/lib/types/product'

// ── Child mocks: capture the props each child receives so we can drive behavior ──
vi.mock('@/components/store/product/ImageCarousel', async () => {
  const { createElement } = await import('react')
  return {
    ImageCarousel: ({ images }: { images: ProductImage[] }) =>
      createElement('div', { 'data-testid': 'carousel', 'data-count': images.length }),
  }
})

vi.mock('@/components/store/product/VariantSelector', async () => {
  const { createElement } = await import('react')
  return {
    VariantSelector: ({
      variants,
      selectedVariantId,
      onSelect,
    }: {
      variants: Variant[]
      selectedVariantId: string
      onSelect: (id: string) => void
    }) =>
      createElement(
        'div',
        { 'data-testid': 'variant-selector', 'data-selected': selectedVariantId },
        variants.map((v) =>
          createElement(
            'button',
            { key: v.id, 'data-testid': `pick-${v.id}`, onClick: () => onSelect(v.id) },
            v.label,
          ),
        ),
      ),
  }
})

vi.mock('@/components/store/product/SizePicker', async () => {
  const { createElement } = await import('react')
  return {
    SizePicker: ({
      sizes,
      selectedSizeId,
      onSelect,
    }: {
      sizes: SizeOption[]
      selectedSizeId: string | null
      onSelect: (id: string) => void
    }) =>
      createElement(
        'div',
        {
          'data-testid': 'size-picker',
          'data-selected': selectedSizeId ?? '',
          'data-count': sizes.length,
        },
        sizes.map((s) =>
          createElement(
            'button',
            { key: s.id, 'data-testid': `size-${s.id}`, onClick: () => onSelect(s.id) },
            s.size,
          ),
        ),
      ),
  }
})

vi.mock('@/components/store/product/ProductActions', async () => {
  const { createElement } = await import('react')
  return {
    ProductActions: (p: {
      onAddToCart: () => void
      onBuyNow: () => void
      onWhatsApp: () => void
      onCOD: () => void
      onNotifyMe: () => void
      allSizesOOS: boolean
      isAddingToCart: boolean
      selectedSize: SizeOption | null
    }) =>
      createElement(
        'div',
        {
          'data-testid': 'actions',
          'data-oos': String(p.allSizesOOS),
          'data-adding': String(p.isAddingToCart),
          'data-size': p.selectedSize?.id ?? '',
        },
        createElement('button', { 'data-testid': 'add', onClick: p.onAddToCart }, 'add'),
        createElement('button', { 'data-testid': 'buy', onClick: p.onBuyNow }, 'buy'),
        createElement('button', { 'data-testid': 'wa', onClick: p.onWhatsApp }, 'wa'),
        createElement('button', { 'data-testid': 'cod', onClick: p.onCOD }, 'cod'),
        createElement('button', { 'data-testid': 'notify', onClick: p.onNotifyMe }, 'notify'),
      ),
  }
})

vi.mock('@/components/store/product/NotifyMeDialog', async () => {
  const { createElement } = await import('react')
  return {
    NotifyMeDialog: (p: {
      open: boolean
      sizeOptionId: string
      size: string
      variantLabel: string
    }) =>
      createElement('div', {
        'data-testid': 'notify-dialog',
        'data-open': String(p.open),
        'data-size-id': p.sizeOptionId,
        'data-size': p.size,
        'data-variant': p.variantLabel,
      }),
  }
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const product: Product = {
  id: 'prod-1',
  name: 'Cool Hoodie',
  description: 'A warm hoodie',
  active: true,
  reviewsEnabled: true,
  stripeProductId: null,
  createdAt: '2024-01-01 00:00:00',
  updatedAt: '2024-01-01 00:00:00',
}

function size(
  id: string,
  sz: string,
  priceCents: number,
  stock: number,
  active = true,
): SizeOption {
  return {
    id,
    variantId: 'v1',
    size: sz,
    sku: null,
    priceCents,
    stock,
    stripePriceId: null,
    active,
  }
}

function img(id: string, variantId: string): ProductImage {
  return { id, variantId, url: `/${id}.jpg`, r2Key: id, sortOrder: 0 }
}

const variants: Variant[] = [
  { id: 'v1', productId: 'prod-1', label: 'Red', colorHex: '#f00', sortOrder: 0 },
  { id: 'v2', productId: 'prod-1', label: 'Blue', colorHex: '#00f', sortOrder: 1 },
]

function makeProps(overrides: Partial<ProductHeroProps> = {}): ProductHeroProps {
  return {
    product,
    variants,
    sizesByVariant: {
      v1: [size('s-m', 'M', 1000, 5), size('s-l', 'L', 1500, 3)],
      v2: [size('s2-m', 'M', 2000, 0)],
    },
    imagesByVariant: {
      v1: [img('i1', 'v1'), img('i2', 'v1')],
      v2: [img('i3', 'v2')],
    },
    currency: 'PKR',
    showWhatsApp: true,
    onAddToCart: vi.fn(),
    onBuyNow: vi.fn(),
    onWhatsApp: vi.fn(),
    onCOD: vi.fn(),
    ...overrides,
  }
}

describe('ProductHero', () => {
  it('renders product name and description', () => {
    render(<ProductHero {...makeProps()} />)
    expect(screen.getByText('Cool Hoodie')).toBeTruthy()
    expect(screen.getByText('A warm hoodie')).toBeTruthy()
  })

  it('omits description paragraph when product has none', () => {
    render(<ProductHero {...makeProps({ product: { ...product, description: '' } })} />)
    expect(screen.queryByText('A warm hoodie')).toBeNull()
  })

  it('shows a price range across active in-stock sizes', () => {
    render(<ProductHero {...makeProps()} />)
    // v1 active sizes: 1000 & 1500 → ₨1,000 – ₨1,500
    expect(screen.getByText('₨1,000 – ₨1,500')).toBeTruthy()
  })

  it('shows a single price when all active sizes share one price', () => {
    render(
      <ProductHero
        {...makeProps({ sizesByVariant: { v1: [size('s-m', 'M', 1000, 5)], v2: [] } })}
      />,
    )
    expect(screen.getByText('₨1,000')).toBeTruthy()
  })

  it('renders no price label when no eligible sizes exist', () => {
    render(<ProductHero {...makeProps({ sizesByVariant: { v1: [], v2: [] } })} />)
    expect(screen.queryByText(/₨/)).toBeNull()
  })

  it('shows out-of-stock label when every active size has 0 stock', () => {
    render(
      <ProductHero
        {...makeProps({ sizesByVariant: { v1: [size('s-m', 'M', 1000, 0)], v2: [] } })}
      />,
    )
    expect(screen.getByText(en.store.outOfStock)).toBeTruthy()
  })

  it('renders New and Popular badges when flagged', () => {
    render(<ProductHero {...makeProps({ isNew: true, isPopular: true })} />)
    expect(screen.getByText(en.product.new)).toBeTruthy()
    expect(screen.getByText(en.product.popularChoice)).toBeTruthy()
  })

  it('renders no badges when neither flag is set', () => {
    render(<ProductHero {...makeProps()} />)
    expect(screen.queryByText(en.product.new)).toBeNull()
    expect(screen.queryByText(en.product.popularChoice)).toBeNull()
  })

  it('shows the variant selector only when more than one variant', () => {
    render(<ProductHero {...makeProps()} />)
    expect(screen.getByTestId('variant-selector')).toBeTruthy()
  })

  it('hides the variant selector with a single variant', () => {
    render(
      <ProductHero
        {...makeProps({
          variants: [variants[0]],
          sizesByVariant: { v1: [size('s-m', 'M', 1000, 5)] },
          imagesByVariant: { v1: [img('i1', 'v1')] },
        })}
      />,
    )
    expect(screen.queryByTestId('variant-selector')).toBeNull()
  })

  it('sorts active sizes and filters inactive ones for the size picker', () => {
    render(
      <ProductHero
        {...makeProps({
          sizesByVariant: {
            v1: [
              size('s-l', 'L', 1500, 3),
              size('s-m', 'M', 1000, 5),
              size('s-x', 'X', 900, 5, false),
            ],
            v2: [],
          },
        })}
      />,
    )
    // inactive 'X' filtered → 2 sizes
    expect(screen.getByTestId('size-picker').getAttribute('data-count')).toBe('2')
    // sorted alphabetically via localeCompare → L, M
    const buttons = screen.getAllByTestId(/^size-s-/)
    expect(buttons.map((b) => b.textContent)).toEqual(['L', 'M'])
  })

  it('carousel reflects the selected variant images and updates on variant change', () => {
    render(<ProductHero {...makeProps()} />)
    expect(screen.getByTestId('carousel').getAttribute('data-count')).toBe('2')
    fireEvent.click(screen.getByTestId('pick-v2'))
    expect(screen.getByTestId('carousel').getAttribute('data-count')).toBe('1')
  })

  it('resets the selected size when the variant changes', () => {
    render(<ProductHero {...makeProps()} />)
    fireEvent.click(screen.getByTestId('size-s-m'))
    expect(screen.getByTestId('size-picker').getAttribute('data-selected')).toBe('s-m')
    fireEvent.click(screen.getByTestId('pick-v2'))
    expect(screen.getByTestId('size-picker').getAttribute('data-selected')).toBe('')
  })

  it('does not fire action callbacks until a size is selected', () => {
    const props = makeProps()
    render(<ProductHero {...props} />)
    fireEvent.click(screen.getByTestId('add'))
    fireEvent.click(screen.getByTestId('buy'))
    fireEvent.click(screen.getByTestId('wa'))
    fireEvent.click(screen.getByTestId('cod'))
    expect(props.onAddToCart).not.toHaveBeenCalled()
    expect(props.onBuyNow).not.toHaveBeenCalled()
    expect(props.onWhatsApp).not.toHaveBeenCalled()
    expect(props.onCOD).not.toHaveBeenCalled()
  })

  it('fires each action callback with the selected size object', () => {
    const props = makeProps()
    render(<ProductHero {...props} />)
    fireEvent.click(screen.getByTestId('size-s-m'))
    fireEvent.click(screen.getByTestId('add'))
    fireEvent.click(screen.getByTestId('buy'))
    fireEvent.click(screen.getByTestId('wa'))
    fireEvent.click(screen.getByTestId('cod'))
    expect(props.onAddToCart).toHaveBeenCalledWith(expect.objectContaining({ id: 's-m' }))
    expect(props.onBuyNow).toHaveBeenCalledWith(expect.objectContaining({ id: 's-m' }))
    expect(props.onWhatsApp).toHaveBeenCalledWith(expect.objectContaining({ id: 's-m' }))
    expect(props.onCOD).toHaveBeenCalledWith(expect.objectContaining({ id: 's-m' }))
  })

  it('forwards isAddingToCart to ProductActions', () => {
    render(<ProductHero {...makeProps({ isAddingToCart: true })} />)
    expect(screen.getByTestId('actions').getAttribute('data-adding')).toBe('true')
  })

  it('opens the notify dialog when notify-me is clicked', async () => {
    render(<ProductHero {...makeProps()} />)
    // Dialog is not mounted until first open (deferred chunk gate)
    expect(screen.queryByTestId('notify-dialog')).toBeNull()
    fireEvent.click(screen.getByTestId('notify'))
    // next/dynamic resolves async — wait for the lazy chunk to render
    await waitFor(() =>
      expect(screen.getByTestId('notify-dialog').getAttribute('data-open')).toBe('true'),
    )
  })

  it('targets the first OOS size for the notify dialog', async () => {
    render(
      <ProductHero
        {...makeProps({
          variants: [variants[0]],
          sizesByVariant: { v1: [size('s-in', 'M', 1000, 5), size('s-oos', 'L', 1200, 0)] },
          imagesByVariant: { v1: [img('i1', 'v1')] },
        })}
      />,
    )
    // Open the dialog first (it's gate-mounted only when open)
    fireEvent.click(screen.getByTestId('notify'))
    // next/dynamic resolves async — wait for the lazy chunk
    await waitFor(() =>
      expect(screen.getByTestId('notify-dialog').getAttribute('data-size-id')).toBe('s-oos'),
    )
  })

  it('does not render the notify dialog when no sizes exist for the variant', () => {
    render(
      <ProductHero
        {...makeProps({
          variants: [variants[0]],
          sizesByVariant: { v1: [] },
          imagesByVariant: { v1: [] },
        })}
      />,
    )
    expect(screen.queryByTestId('notify-dialog')).toBeNull()
  })

  it('handles empty variants array without crashing', () => {
    render(
      <ProductHero {...makeProps({ variants: [], sizesByVariant: {}, imagesByVariant: {} })} />,
    )
    expect(screen.getByText('Cool Hoodie')).toBeTruthy()
    expect(screen.queryByTestId('notify-dialog')).toBeNull()
  })

  it('applies a custom className to the root grid', () => {
    const { container } = render(<ProductHero {...makeProps({ className: 'hero-x' })} />)
    expect(container.querySelector('.hero-x')).toBeTruthy()
  })
})
