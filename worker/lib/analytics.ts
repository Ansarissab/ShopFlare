import { gte, ne, and, sql } from 'drizzle-orm'
import * as schema from 'worker/db/schema'

// ─── Period helper ────────────────────────────────────────────────────────────

export function sinceDate(period: string): string | undefined {
  const days: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 }
  const d = days[period]
  if (!d) return undefined
  return new Date(Date.now() - d * 86_400_000).toISOString()
}

// ─── Filter builders ──────────────────────────────────────────────────────────

export function periodFilter(since: string | undefined) {
  return since ? gte(schema.orders.createdAt, since) : sql`1 = 1`
}

export function activeOrdersFilter(since: string | undefined) {
  return and(ne(schema.orders.status, 'cancelled'), periodFilter(since))
}

// ─── RFM thresholds (tertiles — tune via constants if needed) ─────────────────

export const RFM_RECENCY_DAYS_HIGH = 30 // recent = ordered within 30 days
export const RFM_RECENCY_DAYS_MED = 90 // medium = ordered within 90 days
export const RFM_FREQUENCY_HIGH = 3 // loyal = 3+ orders
export const RFM_FREQUENCY_MED = 2

// ─── Checkout abandonment window ─────────────────────────────────────────────

export const ABANDONMENT_HOURS = 24 // pending orders older than N hours = abandoned

// ─── Affinity cap ─────────────────────────────────────────────────────────────

export const AFFINITY_PAIR_LIMIT = 20
export const AFFINITY_PRODUCT_LIMIT = 5

// ─── Slow-mover bottom-N ──────────────────────────────────────────────────────

export const SLOW_MOVERS_LIMIT = 10

// ─── Top customers limit ──────────────────────────────────────────────────────

export const TOP_CUSTOMERS_LIMIT = 20

// ─── Event sampling rate for product_view (fraction, 1 = 100%) ───────────────

export const EVENT_SAMPLE_RATE = 0.2 // sample 20% of product views to stay in D1 free tier
