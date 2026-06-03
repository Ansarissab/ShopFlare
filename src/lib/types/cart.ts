import type { CartItem } from '@/hooks/useCart'

export interface CartItemProps {
  item: CartItem
}

export interface CartSheetProps {
  flatRateCents?: number
  thresholdCents?: number
}

export interface CartSummaryProps {
  subtotalCents: number
  shippingCents: number
  onApplyCoupon: (code: string) => Promise<boolean>
  couponApplied?: boolean
  discountCents?: number
  onClose: () => void
}

export interface FreeShippingBarProps {
  subtotalCents: number
  thresholdCents: number
  flatRateCents: number
}
