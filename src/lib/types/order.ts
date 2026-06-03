import type { Order } from 'worker/db/schema'
import type { OrderStatus } from '@/lib/constants'

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
  customerName?: string
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

export type CancelOrder = Omit<Pick<Order, 'orderNumber' | 'status' | 'customerName' | 'totalCents'>, 'customerName'> & { customerName?: string }

export interface OrderTimelineProps {
  status: OrderStatus
  trackingNumber?: string
  carrier?: string
}
