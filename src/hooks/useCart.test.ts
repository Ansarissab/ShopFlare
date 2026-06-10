// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { useCart, useCartItemCount, useCartSubtotalCents, type CartItem } from './useCart'
import { renderHook } from '@testing-library/react'

function makeItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    sizeOptionId: 'so-1',
    productId: 'p-1',
    variantId: 'v-1',
    productName: 'Tee',
    variantLabel: 'Red',
    size: 'M',
    sku: 'TEE-RED-M',
    priceCents: 1000,
    stripePriceId: 'price_1',
    imageUrl: 'https://img/1.png',
    quantity: 1,
    ...overrides,
  }
}

// Reset the persisted store to its initial shape before every test so each
// assertion starts from an empty cart.
beforeEach(() => {
  act(() => {
    useCart.setState({
      items: [],
      isOpen: false,
      couponCode: null,
      discountCents: 0,
    })
  })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('useCart store', () => {
  it('addItem inserts a new item when none matches the sizeOptionId', () => {
    act(() => useCart.getState().addItem(makeItem()))
    expect(useCart.getState().items).toHaveLength(1)
    expect(useCart.getState().items[0].sizeOptionId).toBe('so-1')
  })

  it('addItem merges quantity into an existing matching line', () => {
    act(() => useCart.getState().addItem(makeItem({ quantity: 2 })))
    act(() => useCart.getState().addItem(makeItem({ quantity: 3 })))
    expect(useCart.getState().items).toHaveLength(1)
    expect(useCart.getState().items[0].quantity).toBe(5)
  })

  it('addItem keeps distinct sizeOptionIds as separate lines', () => {
    act(() => useCart.getState().addItem(makeItem({ sizeOptionId: 'so-1' })))
    act(() => useCart.getState().addItem(makeItem({ sizeOptionId: 'so-2' })))
    expect(useCart.getState().items).toHaveLength(2)
  })

  it('merging an existing line leaves the other lines untouched', () => {
    act(() => {
      useCart.getState().addItem(makeItem({ sizeOptionId: 'so-1', quantity: 1 }))
      useCart.getState().addItem(makeItem({ sizeOptionId: 'so-2', quantity: 2 }))
      // re-add so-1 — the map must keep so-2 as-is (covers the non-matching else branch)
      useCart.getState().addItem(makeItem({ sizeOptionId: 'so-1', quantity: 3 }))
    })
    const items = useCart.getState().items
    expect(items).toHaveLength(2)
    expect(items.find((i) => i.sizeOptionId === 'so-1')!.quantity).toBe(4)
    expect(items.find((i) => i.sizeOptionId === 'so-2')!.quantity).toBe(2)
  })

  it('removeItem drops only the matching line', () => {
    act(() => {
      useCart.getState().addItem(makeItem({ sizeOptionId: 'so-1' }))
      useCart.getState().addItem(makeItem({ sizeOptionId: 'so-2' }))
    })
    act(() => useCart.getState().removeItem('so-1'))
    expect(useCart.getState().items.map((i) => i.sizeOptionId)).toEqual(['so-2'])
  })

  it('updateQuantity sets a new positive quantity', () => {
    act(() => useCart.getState().addItem(makeItem()))
    act(() => useCart.getState().updateQuantity('so-1', 7))
    expect(useCart.getState().items[0].quantity).toBe(7)
  })

  it('updateQuantity leaves non-matching lines untouched', () => {
    act(() => {
      useCart.getState().addItem(makeItem({ sizeOptionId: 'so-1', quantity: 1 }))
      useCart.getState().addItem(makeItem({ sizeOptionId: 'so-2', quantity: 1 }))
    })
    act(() => useCart.getState().updateQuantity('so-1', 4))
    const byId = Object.fromEntries(
      useCart.getState().items.map((i) => [i.sizeOptionId, i.quantity]),
    )
    expect(byId).toEqual({ 'so-1': 4, 'so-2': 1 })
  })

  it('updateQuantity removes the line when qty <= 0', () => {
    act(() => {
      useCart.getState().addItem(makeItem({ sizeOptionId: 'so-1' }))
      useCart.getState().addItem(makeItem({ sizeOptionId: 'so-2' }))
    })
    act(() => useCart.getState().updateQuantity('so-1', 0))
    expect(useCart.getState().items.map((i) => i.sizeOptionId)).toEqual(['so-2'])
  })

  it('updateQuantity removes the line on a negative qty', () => {
    act(() => useCart.getState().addItem(makeItem()))
    act(() => useCart.getState().updateQuantity('so-1', -5))
    expect(useCart.getState().items).toHaveLength(0)
  })

  it('clearCart empties items and resets coupon state', () => {
    act(() => {
      useCart.getState().addItem(makeItem())
      useCart.getState().applyCoupon('SAVE10', 500)
    })
    act(() => useCart.getState().clearCart())
    const s = useCart.getState()
    expect(s.items).toHaveLength(0)
    expect(s.couponCode).toBeNull()
    expect(s.discountCents).toBe(0)
  })

  it('openCart / closeCart toggle isOpen', () => {
    act(() => useCart.getState().openCart())
    expect(useCart.getState().isOpen).toBe(true)
    act(() => useCart.getState().closeCart())
    expect(useCart.getState().isOpen).toBe(false)
  })

  it('applyCoupon stores the code and discount', () => {
    act(() => useCart.getState().applyCoupon('SAVE10', 500))
    const s = useCart.getState()
    expect(s.couponCode).toBe('SAVE10')
    expect(s.discountCents).toBe(500)
  })

  it('removeCoupon clears the code and discount', () => {
    act(() => useCart.getState().applyCoupon('SAVE10', 500))
    act(() => useCart.getState().removeCoupon())
    const s = useCart.getState()
    expect(s.couponCode).toBeNull()
    expect(s.discountCents).toBe(0)
  })
})

describe('useCart selectors', () => {
  it('useCartItemCount sums quantities across lines', () => {
    act(() => {
      useCart.getState().addItem(makeItem({ sizeOptionId: 'so-1', quantity: 2 }))
      useCart.getState().addItem(makeItem({ sizeOptionId: 'so-2', quantity: 3 }))
    })
    const { result } = renderHook(() => useCartItemCount())
    expect(result.current).toBe(5)
  })

  it('useCartItemCount is 0 for an empty cart', () => {
    const { result } = renderHook(() => useCartItemCount())
    expect(result.current).toBe(0)
  })

  it('useCartSubtotalCents sums priceCents * quantity', () => {
    act(() => {
      useCart.getState().addItem(makeItem({ sizeOptionId: 'so-1', priceCents: 1000, quantity: 2 }))
      useCart.getState().addItem(makeItem({ sizeOptionId: 'so-2', priceCents: 250, quantity: 4 }))
    })
    const { result } = renderHook(() => useCartSubtotalCents())
    expect(result.current).toBe(1000 * 2 + 250 * 4)
  })
})
