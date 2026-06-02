// Central type definitions for the store frontend.
// ALL interfaces and prop types live here — never declare them per-file.

import type * as React from 'react'
import type { Product, Variant, SizeOption, ProductImage, Order, Coupon, Review } from 'worker/db/schema'
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

// Shared shipping-address order form, used by both the COD and Bank Transfer
// checkout tabs (manual payment paths — same fields + Turnstile, different
// endpoint + success route).
export interface ManualOrderFormProps {
  /** Worker endpoint to POST the order to, e.g. '/api/orders/cod'. */
  endpoint: string
  /** `method` query value on the success redirect (drives the thank-you copy). */
  successMethod: string
  /** Submit button label. */
  submitLabel: string
}

// Bank-transfer instructions card, shown on the thank-you + tracking pages for a
// bank_transfer order. Reads the merchant's bank details from store config.
export interface BankTransferInstructionsProps {
  orderNumber: string
  totalCents: number
}

// ─── Tracking component props ─────────────────────────────────────────────────

export interface OrderTimelineProps {
  status: OrderStatus
  trackingNumber?: string
  carrier?: string
}

// ─── Admin types ──────────────────────────────────────────────────────────────

import type { OrderItem } from 'worker/db/schema'
export type { OrderItem }

export interface AdminOrder {
  id: string
  orderNumber: string
  status: OrderStatus
  paymentMethod: string
  customerName: string
  customerEmail: string | null
  customerPhone: string | null
  totalCents: number
  subtotalCents: number
  shippingCents: number
  discountCents: number
  couponCode: string | null
  trackingNumber: string | null
  carrier: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface AdminOrderItem {
  id: string
  sizeOptionId: string
  productId: string
  variantId: string
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

export interface AdminOrderDetail {
  order: AdminOrder
  items: AdminOrderItem[]
  shippingAddress: Record<string, string> | null
}

export interface AdminOrdersResponse {
  orders: AdminOrder[]
  total: number
  page: number
  limit: number
}

export interface AdminProductListItem {
  id: string
  name: string
  description: string
  active: boolean
  stripeProductId: string | null
  variantCount: number
  createdAt: string
}

// ─── POS types ────────────────────────────────────────────────────────────────

export interface POSSaleItem {
  sizeOptionId: string
  productId: string
  variantId: string
  productName: string
  variantLabel: string
  size: string
  sku?: string
  priceCents: number
  imageUrl: string
  quantity: number
}

// ─── Admin component props ────────────────────────────────────────────────────

export interface AdminOrderRowProps {
  order: AdminOrder
}

export interface AdminStatCardProps {
  label: string
  value: string | number
  sub?: string
}

// ─── Coupon types (Agent N) ───────────────────────────────────────────────────
// AdminCoupon is the raw Drizzle row — never redeclare its fields.
export type { Coupon }
export type AdminCoupon = Coupon

export interface CouponsResponse {
  coupons: AdminCoupon[]
}

export interface CouponFormProps {
  /** Existing coupon when editing; undefined when creating. */
  coupon?: AdminCoupon
  onSaved: () => void
  onCancel: () => void
}

export interface CouponRowProps {
  coupon: AdminCoupon
  onEdit: (coupon: AdminCoupon) => void
  onDeleted: () => void
}

export interface CouponsTableProps {
  coupons: AdminCoupon[]
  onEdit: (coupon: AdminCoupon) => void
  onDeleted: () => void
}

// ─── Review types (Agent P) ───────────────────────────────────────────────────
export type { Review }

// Public, display-safe review (approved only; no order/PII linkage exposed).
export interface ProductReview {
  id: string
  customerName: string
  rating: number
  body: string | null
  createdAt: string
}

export interface ProductReviewsResponse {
  reviews: ProductReview[]
  average: number
  count: number
}

// Admin moderation row — full row plus the resolved product name for display.
export interface AdminReview extends Review {
  productName: string
}

export interface AdminReviewsResponse {
  reviews: AdminReview[]
}

export interface ReviewStarsProps {
  rating: number
  /** Interactive (clickable) when onChange is provided. */
  onChange?: (rating: number) => void
  className?: string
}

export interface ReviewsSectionProps {
  productId: string
  productName: string
  className?: string
}

export interface ReviewFormProps {
  productId: string
  productName: string
  onSubmitted: () => void
}

export interface AdminReviewRowProps {
  review: AdminReview
  onChanged: () => void
}

export interface ReviewTableProps {
  reviews: AdminReview[]
  onChanged: () => void
}

// ─── Notify-Me / restock types (Agent Q) ──────────────────────────────────────
// Aggregated outstanding restock request for one size option.
export interface NotifyRequest {
  sizeOptionId: string
  size: string
  productName: string
  variantLabel: string
  waiting: number          // count of un-notified subscribers
  lastRequestedAt: string
  inStock: boolean         // current stock > 0 or unlimited
}

export interface NotifyRequestsResponse {
  requests: NotifyRequest[]
}

export interface NotifyRequestRowProps {
  request: NotifyRequest
}

// ─── SEO / structured data (Agent R) ──────────────────────────────────────────
export interface ProductJsonLdProps {
  item: ProductWithVariants
  /** Optional aggregate rating, when reviews exist. */
  rating?: { average: number; count: number }
  /** Absolute store origin for canonical URLs. */
  storeUrl?: string
  storeName?: string
}

// schema.org offer block emitted in the Product JSON-LD — AggregateOffer for a
// price range, Offer for a single/known price, Offer (no price) as a fallback.
export type ProductJsonLdOffer =
  | { '@type': 'AggregateOffer'; lowPrice: number; highPrice: number; offerCount: number; priceCurrency: string; availability: string; url?: string }
  | { '@type': 'Offer'; price: number; priceCurrency: string; availability: string; url?: string }
  | { '@type': 'Offer'; priceCurrency: string; availability: string; url?: string }

// ─── Web Push (Agent O) ────────────────────────────────────────────────────────
// Response shape of GET /api/public-config (non-secret keys served to the client).
export interface PublicConfigResponse {
  vapidPublicKey: string
  stripePublishableKey: string
  turnstileSiteKey: string
}

export interface UsePushSubscriptionReturn {
  supported: boolean
  permission: NotificationPermission
  enabled: boolean
  /** Resolves true only when the subscription was created + persisted. */
  enable: () => Promise<boolean>
  loading: boolean
}
