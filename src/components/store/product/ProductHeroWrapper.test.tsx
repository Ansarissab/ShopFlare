// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, waitFor } from '@testing-library/react'
import { ProductHeroWrapper } from './ProductHeroWrapper'
import { en } from '@/lib/i18n/en'
import type { ProductHeroProps } from '@/lib/types/product'
import type { ProductWithVariants, SizeOption } from '@/lib/types/product'

// ── Capture props handed to ProductHero so we can drive its callbacks ──────────
let heroProps: ProductHeroProps | undefined
vi.mock('@/components/store/product/ProductHero', async () => {
  const { createElement } = await import('react')
  return {
    ProductHero: (props: ProductHeroProps) => {
      heroProps = props
      return createElement('div', { 'data-testid': 'hero' })
    },
  }
})

const addItem = vi.fn()
const openCart = vi.fn()
vi.mock('@/hooks/useCart', () => ({
  useCart: () => ({ addItem, openCart }),
}))

let storeConfig: { whatsappNumber?: string; currency?: string } | null = {
  whatsappNumber: '15550001111',
  currency: 'USD',
}
vi.mock('@/hooks/useStoreConfig', () => ({
  useStoreConfig: () => ({ config: storeConfig }),
}))

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
}))

vi.mock('@/lib/api', () => ({ apiPost: vi.fn(() => Promise.resolve({ url: '/stripe-url' })) }))
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))

const buildWhatsAppOrderUrl = vi.fn((..._a: unknown[]) => 'https://wa.me/x')
vi.mock('@/lib/whatsapp', () => ({
  buildWhatsAppOrderUrl: (...a: unknown[]) => buildWhatsAppOrderUrl(...a),
}))

import { apiPost } from '@/lib/api'
import { toast } from 'sonner'
const apiPostMock = vi.mocked(apiPost)
const toastError = vi.mocked(toast.error)

const sizeA: SizeOption = {
  id: 'sz-1',
  variantId: 'var-1',
  size: 'M',
  sku: 'SKU-1',
  priceCents: 2500,
  stripePriceId: 'price_123',
} as SizeOption

const sizeNoStripe: SizeOption = { ...sizeA, id: 'sz-2', stripePriceId: null } as SizeOption

const item: ProductWithVariants = {
  product: { id: 'prod-1', name: 'Hoodie' },
  variants: [
    {
      id: 'var-1',
      productId: 'prod-1',
      label: 'Blue',
      colorHex: '#00f',
      images: [{ id: 'img-1', variantId: 'var-1', url: '/a.jpg', position: 0 }],
      sizes: [sizeA, sizeNoStripe],
    },
  ],
  categoryIds: [],
} as unknown as ProductWithVariants

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  heroProps = undefined
  storeConfig = { whatsappNumber: '15550001111', currency: 'USD' }
})

describe('ProductHeroWrapper', () => {
  it('renders ProductHero with derived maps and currency', () => {
    render(<ProductHeroWrapper item={item} />)
    expect(heroProps).toBeDefined()
    expect(heroProps!.currency).toBe('USD')
    expect(heroProps!.product).toBe(item.product)
    expect(heroProps!.sizesByVariant['var-1']).toHaveLength(2)
    expect(heroProps!.imagesByVariant['var-1']).toHaveLength(1)
  })

  it('falls back to the default currency when config is null', () => {
    storeConfig = null
    render(<ProductHeroWrapper item={item} />)
    expect(heroProps!.currency).toBe('PKR')
  })

  it('onAddToCart adds the built cart item and opens the cart', () => {
    render(<ProductHeroWrapper item={item} />)
    heroProps!.onAddToCart(sizeA)
    expect(addItem).toHaveBeenCalledTimes(1)
    const built = addItem.mock.calls[0][0]
    expect(built).toMatchObject({
      sizeOptionId: 'sz-1',
      productId: 'prod-1',
      variantId: 'var-1',
      productName: 'Hoodie',
      variantLabel: 'Blue',
      size: 'M',
      sku: 'SKU-1',
      priceCents: 2500,
      stripePriceId: 'price_123',
      imageUrl: '/a.jpg',
      quantity: 1,
    })
    expect(openCart).toHaveBeenCalledTimes(1)
  })

  it('onBuyNow uses Stripe checkout and routes to the returned url', async () => {
    render(<ProductHeroWrapper item={item} />)
    await heroProps!.onBuyNow(sizeA)
    expect(apiPostMock).toHaveBeenCalledWith('/api/stripe/checkout-session', {
      items: [{ stripePriceId: 'price_123', quantity: 1 }],
    })
    expect(push).toHaveBeenCalledWith('/stripe-url')
    expect(addItem).not.toHaveBeenCalled()
  })

  it('onBuyNow falls back to cart + checkout when Stripe request fails', async () => {
    apiPostMock.mockRejectedValueOnce(new Error('nope'))
    render(<ProductHeroWrapper item={item} />)
    await heroProps!.onBuyNow(sizeA)
    expect(toastError).toHaveBeenCalledWith(en.errors.orderFailed)
    expect(addItem).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith('/checkout')
  })

  it('onBuyNow with no stripePriceId adds to cart and routes to checkout', async () => {
    render(<ProductHeroWrapper item={item} />)
    await heroProps!.onBuyNow(sizeNoStripe)
    expect(apiPostMock).not.toHaveBeenCalled()
    expect(addItem).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith('/checkout')
  })

  it('onWhatsApp opens a WhatsApp URL when a number is configured', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(<ProductHeroWrapper item={item} />)
    heroProps!.onWhatsApp(sizeA)
    expect(buildWhatsAppOrderUrl).toHaveBeenCalledTimes(1)
    expect(openSpy).toHaveBeenCalledWith('https://wa.me/x', '_blank', 'noopener,noreferrer')
    openSpy.mockRestore()
  })

  it('onWhatsApp shows a network error when no number is configured', () => {
    storeConfig = { whatsappNumber: undefined, currency: 'USD' }
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(<ProductHeroWrapper item={item} />)
    heroProps!.onWhatsApp(sizeA)
    expect(toastError).toHaveBeenCalledWith(en.errors.networkError)
    expect(openSpy).not.toHaveBeenCalled()
    openSpy.mockRestore()
  })

  it('onCOD adds to cart and routes to checkout', () => {
    render(<ProductHeroWrapper item={item} />)
    heroProps!.onCOD(sizeA)
    expect(addItem).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith('/checkout')
  })

  it('onWhatsApp falls back to the default currency when config has none', () => {
    storeConfig = { whatsappNumber: '15550001111', currency: undefined }
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(<ProductHeroWrapper item={item} />)
    heroProps!.onWhatsApp(sizeA)
    expect(buildWhatsAppOrderUrl).toHaveBeenCalledTimes(1)
    const arg = buildWhatsAppOrderUrl.mock.calls[0][0] as { currency: string }
    expect(arg.currency).toBe('PKR')
    openSpy.mockRestore()
  })

  it('onWhatsApp uses empty variant label when the size has no matching variant', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(<ProductHeroWrapper item={item} />)
    const orphan = { ...sizeA, id: 'orphan' } as SizeOption
    heroProps!.onWhatsApp(orphan)
    const arg = buildWhatsAppOrderUrl.mock.calls[0][0] as { variantLabel: string; sku?: string }
    expect(arg.variantLabel).toBe('')
    openSpy.mockRestore()
  })

  it('builds a cart item with empty fallbacks when the variant is not found', async () => {
    render(<ProductHeroWrapper item={item} />)
    const orphan = { ...sizeA, id: 'orphan', stripePriceId: null } as SizeOption
    heroProps!.onAddToCart(orphan)
    await waitFor(() => expect(addItem).toHaveBeenCalled())
    const built = addItem.mock.calls[0][0]
    expect(built.variantId).toBe('')
    expect(built.variantLabel).toBe('')
    expect(built.imageUrl).toBe('')
  })
})
