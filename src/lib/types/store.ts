// Central type definitions for the store frontend.
// ALL interfaces and prop types live here — never declare them per-file.

import type * as React from 'react'
import type { Product, Variant, SizeOption, ProductImage, Order } from 'worker/db/schema'
import type { OrderStatus, CurrencyCode } from '@/lib/constants'
import type { CartItem } from '@/hooks/useCart'
import type { StoreConfigData } from '@/lib/schemas'

// Re-export base types so callers import from one place
export type { Product, Variant, SizeOption, ProductImage }

// ─── Store config ───────────────────────────────────────────────────────────
// Precise client-side type: currency narrowed to CurrencyCode (the Zod schema
// validates at the boundary; this is the authoritative TS shape).
export type StoreConfig = Omit<StoreConfigData, 'currency'> & {
  currency: CurrencyCode
}

// ─── Product composite types ──────────────────────────────────────────────────

export type VariantWithDetails = Variant & {
  images: ProductImage[]
  sizes: SizeOption[]
}

export type ProductWithVariants = {
  product: Product
  variants: VariantWithDetails[]
}

// ─── Order tracking types ─────────────────────────────────────────────────────

export interface TrackingItem {
  quantity: number
  priceCents: number
  snapshot: {
    productName: string
    variantLabel: string
    size: string
    sku?: string
    imageUrl: string
  }
}

export interface TrackingOrder {
  orderNumber: string
  status: OrderStatus
  paymentMethod: string
  customerName: string
  subtotalCents: number
  shippingCents: number
  totalCents: number
  trackingNumber?: string
  carrier?: string
  createdAt: string
  updatedAt: string
}

export interface TrackingData {
  order: TrackingOrder
  items: TrackingItem[]
}

export type CancelOrder = Pick<Order, 'orderNumber' | 'status' | 'customerName' | 'totalCents'>

// ─── Shared UI / utility types ────────────────────────────────────────────────

export interface FieldProps {
  label: string
  htmlFor: string
  optional?: boolean
  error?: string
  children: React.ReactNode
}

export interface WhatsAppOrderParams {
  phoneNumber: string
  productName: string
  variantLabel: string
  size: string
  sku?: string
  priceCents: number
  currency: CurrencyCode
  quantity: number
}

export interface ApiResourceState<T> {
  data: T | null
  loading: boolean
  error: string | null
  notFound: boolean
}

export interface UseStoreConfigResult {
  config: StoreConfig | null
  loading: boolean
  error: string | null
}

// ─── Cart component props ─────────────────────────────────────────────────────

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

// ─── Product component props ──────────────────────────────────────────────────

export interface ImageCarouselProps {
  images: ProductImage[]
  className?: string
}

export interface VariantSelectorProps {
  variants: Variant[]
  selectedVariantId: string
  onSelect: (id: string) => void
  className?: string
}

export interface SizePickerProps {
  sizes: SizeOption[]
  selectedSizeId: string | null
  onSelect: (id: string) => void
  className?: string
}

export interface ProductActionsProps {
  product: Product
  selectedVariant: Variant | null
  selectedSize: SizeOption | null
  allSizesOOS: boolean
  isAddingToCart: boolean
  onAddToCart: () => void
  onBuyNow: () => void
  onWhatsApp: () => void
  onCOD: () => void
  onNotifyMe: () => void
  className?: string
}

export interface ProductCardProps {
  product: Product
  variants: Variant[]
  sizes: SizeOption[]
  images: ProductImage[]
  isNew?: boolean
  className?: string
}

export interface ProductHeroProps {
  product: Product
  variants: Variant[]
  sizesByVariant: Record<string, SizeOption[]>
  imagesByVariant: Record<string, ProductImage[]>
  isNew?: boolean
  isPopular?: boolean
  onAddToCart: (sizeOption: SizeOption) => void
  onBuyNow: (sizeOption: SizeOption) => void
  onWhatsApp: (sizeOption: SizeOption) => void
  onCOD: (sizeOption: SizeOption) => void
  // NOTE: Notify-Me is handled internally by ProductHero (it owns the
  // variant/size selection that determines which OOS size to notify about),
  // so it is intentionally NOT a prop here.
  isAddingToCart?: boolean
  className?: string
}

export interface ProductHeroWrapperProps {
  item: ProductWithVariants
}

export interface NotifyMeDialogProps {
  sizeOptionId: string
  productName: string
  size: string
  variantLabel: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export interface WhatsAppButtonProps {
  phoneNumber: string
  productName: string
  variantLabel: string
  size: string
  sku?: string
  priceCents: number
  currency: CurrencyCode
  quantity?: number
  disabled?: boolean
}

// ─── Checkout component props ─────────────────────────────────────────────────

export interface TurnstileWidgetProps {
  onVerify: (token: string) => void
  onError?: () => void
}

// ─── Tracking component props ─────────────────────────────────────────────────

export interface OrderTimelineProps {
  status: OrderStatus
  trackingNumber?: string
  carrier?: string
}
