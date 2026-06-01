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
  addItem: (item: CartItem) => void
  removeItem: (sizeOptionId: string) => void
  updateQuantity: (sizeOptionId: string, qty: number) => void
  clearCart: () => void
  openCart: () => void
  closeCart: () => void
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      isOpen: false,

      addItem: (item) =>
        set((state) => {
          const existing = state.items.find(
            (i) => i.sizeOptionId === item.sizeOptionId
          )
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.sizeOptionId === item.sizeOptionId
                  ? { ...i, quantity: i.quantity + item.quantity }
                  : i
              ),
            }
          }
          return { items: [...state.items, item] }
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
              i.sizeOptionId === sizeOptionId ? { ...i, quantity: qty } : i
            ),
          }
        }),

      clearCart: () => set({ items: [] }),

      openCart: () => set({ isOpen: true }),

      closeCart: () => set({ isOpen: false }),
    }),
    { name: 'cart' }
  )
)

// Selectors
export function useCartItemCount() {
  return useCart((state) =>
    state.items.reduce((sum, item) => sum + item.quantity, 0)
  )
}

export function useCartSubtotalCents() {
  return useCart((state) =>
    state.items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0)
  )
}
