export interface AnalyticsSummary {
  totalOrders: number
  totalRevenueCents: number
  cancelledOrders: number
  deliveredOrders: number
  totalDiscountCents: number
}

export interface AnalyticsRevenueDay {
  day: string
  revenueCents: number
  orderCount: number
}

export interface AnalyticsPaymentMethod {
  method: string
  count: number
  revenueCents: number
}

export interface AnalyticsTopProduct {
  productId: string
  productName: string
  unitsSold: number
  revenueCents: number
}

export interface AnalyticsCoupon {
  couponCode: string | null
  uses: number
  totalDiscountCents: number
}

export interface AnalyticsResponse {
  period: string
  summary: AnalyticsSummary
  revenueByDay: AnalyticsRevenueDay[]
  paymentMethods: AnalyticsPaymentMethod[]
  topProducts: AnalyticsTopProduct[]
  couponStats: AnalyticsCoupon[]
}

export interface AnalyticsProductLeaderboardRow {
  productId: string
  productName: string
  orders: number
  unitsSold: number
  revenueCents: number
  aovCents: number
}

export interface AnalyticsVariantRow {
  variantId: string
  variantLabel: string
  colorHex: string | null
  unitsSold: number
  revenueCents: number
}

export interface AnalyticsSizeRow {
  sizeOptionId: string
  size: string
  unitsSold: number
  revenueCents: number
}

export interface AnalyticsSlowMover {
  productId: string
  productName: string
  unitsSold: number
  stockOnHand: number
  unlimited: boolean
  turnoverRatio: number
}

export interface AnalyticsProductsResponse {
  period: string
  leaderboard: AnalyticsProductLeaderboardRow[]
  variants: AnalyticsVariantRow[]
  sizes: AnalyticsSizeRow[]
  slowMovers: AnalyticsSlowMover[]
}

export interface AnalyticsProductDetail {
  productId: string
  period: string
  unitsSold: number
  orders: number
  revenueCents: number
  lastSoldAt: string | null
  stockOnHand: number
  unlimited: boolean
  velocity: { day: string; units: number }[]
  affinityPartners: { productId: string; productName: string; pairCount: number }[]
}

export interface AnalyticsAffinityPair {
  productAId: string
  productAName: string
  productBId: string
  productBName: string
  pairCount: number
  confidencePct: number
}

export interface AnalyticsCustomerSummary {
  totalCustomers: number
  returningCustomers: number
  repeatRatePct: number
  avgClvCents: number
}

export interface AnalyticsTopCustomer {
  customerKey: string
  orders: number
  totalSpentCents: number
  firstOrderAt: string
  lastOrderAt: string
}

export type RfmSegment = 'champions' | 'loyal' | 'at_risk' | 'new' | 'other'

export interface AnalyticsRfmSegmentCount {
  segment: RfmSegment
  count: number
}

export interface AnalyticsCustomersResponse {
  period: string
  summary: AnalyticsCustomerSummary
  topCustomers: AnalyticsTopCustomer[]
  rfmSegments: AnalyticsRfmSegmentCount[]
}

export interface AnalyticsFunnelStage {
  stage: string
  label: string
  count: number
}

export interface AnalyticsAbandonedCheckout {
  orderNumber: string
  customerName: string
  contactHint: string
  totalCents: number
  createdAt: string
  hoursAgo: number
}

export interface AnalyticsFunnelResponse {
  period: string
  funnelStages: AnalyticsFunnelStage[]
  checkoutAbandonmentRatePct: number
  abandonedCheckouts: AnalyticsAbandonedCheckout[]
  layer2Enabled: boolean
  layer2Stages: AnalyticsFunnelStage[]
  sampleRate: number
}

export interface FunnelTabProps {
  period: string
}
