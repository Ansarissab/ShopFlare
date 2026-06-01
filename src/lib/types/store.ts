// Composite store types — extend the Drizzle base types from worker/db/schema.
// Import shared types from here instead of declaring them per-file.

import type { Product, Variant, SizeOption, ProductImage } from 'worker/db/schema'
import type { OrderStatus } from '@/lib/constants'

// Re-export base types so callers can import from one place
export type { Product, Variant, SizeOption, ProductImage }

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

export interface CancelOrder {
  orderNumber: string
  status: OrderStatus
  customerName: string
  totalCents: number
}
