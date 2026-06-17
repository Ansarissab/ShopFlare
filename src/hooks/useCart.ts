'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type CartItem = {
  sizeOptionId: string
  productId: string
  variantId: string
  productName: string
  variantLabel: string
  size: string
  sku?: string
  priceCents: number
  stripePriceId?: string
  imageUrl: string
  quantity: number
}

type CartState = {
  items: CartItem[]
  isOpen: boolean
  couponCode: string | null
  discountCents: number
  /**
   * Unix timestamp (ms) of the last successful addItem call.
   * Subscribers use this to trigger the cart-icon pulse animation.
   * Not persisted — resets to 0 on page load.
   */
  lastAddedAt: number
  addItem: (item: CartItem) => void
  removeItem: (sizeOptionId: string) => void
  updateQuantity: (sizeOptionId: string, qty: number) => void
  clearCart: () => void
  openCart: () => void
  closeCart: () => void
  applyCoupon: (code: string, discountCents: number) => void
  removeCoupon: () => void
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      isOpen: false,
      couponCode: null,
      discountCents: 0,
      lastAddedAt: 0,

      addItem: (item) =>
        set((state) => {
          const existing = state.items.find((i) => i.sizeOptionId === item.sizeOptionId)
          const nextItems = existing
            ? state.items.map((i) =>
                i.sizeOptionId === item.sizeOptionId
                  ? { ...i, quantity: i.quantity + item.quantity }
                  : i,
              )
            : [...state.items, item]
          return { items: nextItems, lastAddedAt: Date.now() }
        }),

      removeItem: (sizeOptionId) =>
        set((state) => ({
          items: state.items.filter((i) => i.sizeOptionId !== sizeOptionId),
        })),

      updateQuantity: (sizeOptionId, qty) =>
        set((state) => {
          if (qty <= 0) {
            return {
              items: state.items.filter((i) => i.sizeOptionId !== sizeOptionId),
            }
          }
          return {
            items: state.items.map((i) =>
              i.sizeOptionId === sizeOptionId ? { ...i, quantity: qty } : i,
            ),
          }
        }),

      clearCart: () => set({ items: [], couponCode: null, discountCents: 0 }),

      openCart: () => set({ isOpen: true }),

      closeCart: () => set({ isOpen: false }),

      applyCoupon: (code, discountCents) => set({ couponCode: code, discountCents }),

      removeCoupon: () => set({ couponCode: null, discountCents: 0 }),
    }),
    {
      name: 'cart',
      // lastAddedAt is transient — exclude from localStorage so it resets on page load
      partialize: (state) => ({
        items: state.items,
        isOpen: state.isOpen,
        couponCode: state.couponCode,
        discountCents: state.discountCents,
      }),
    },
  ),
)

// Selectors
export function useCartItemCount() {
  return useCart((state) => state.items.reduce((sum, item) => sum + item.quantity, 0))
}

export function useCartSubtotalCents() {
  return useCart((state) =>
    state.items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0),
  )
}
