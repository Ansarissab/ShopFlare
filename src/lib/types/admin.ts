import type { OrderItem, Coupon, Review } from 'worker/db/schema'
import type { OrderStatus } from '@/lib/constants'
import type * as React from 'react'

export type { OrderItem, Coupon, Review }
export type AdminCoupon = Coupon

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

export interface AdminPageHeaderProps {
  title: string
  actions?: React.ReactNode
  backHref?: string
}

export interface AdminOrderRowProps {
  order: AdminOrder
}

export interface AdminStatCardProps {
  label: string
  value: string | number
  sub?: string
  href?: string
}

export interface CouponsResponse {
  coupons: AdminCoupon[]
}

export interface CouponFormProps {
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

export interface AdminReview extends Review {
  productName: string
}

export interface AdminReviewsResponse {
  reviews: AdminReview[]
}

export interface AdminReviewRowProps {
  review: AdminReview
  onChanged: () => void
}

export interface ReviewTableProps {
  reviews: AdminReview[]
  onChanged: () => void
}

export interface NotifyRequest {
  sizeOptionId: string
  size: string
  productName: string
  variantLabel: string
  waiting: number
  lastRequestedAt: string
  inStock: boolean
}

export interface NotifyRequestsResponse {
  requests: NotifyRequest[]
}

export interface NotifyRequestRowProps {
  request: NotifyRequest
}

export interface StorePage {
  slug: string
  title: string
  content: string
  updatedAt: string
}

export interface AdminPagesResponse {
  pages: StorePage[]
}
