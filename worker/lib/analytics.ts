import { gte, ne, and, sql } from 'drizzle-orm'
import * as schema from 'worker/db/schema'
import {
  ABANDONMENT_HOURS,
  AFFINITY_PAIR_LIMIT,
  SLOW_MOVERS_LIMIT,
  TOP_CUSTOMERS_LIMIT,
  EVENT_SAMPLE_RATE,
  RFM_RECENCY_DAYS_HIGH,
  RFM_RECENCY_DAYS_MED,
  RFM_FREQUENCY_HIGH,
  RFM_FREQUENCY_MED,
} from '@/lib/constants'

export {
  ABANDONMENT_HOURS,
  AFFINITY_PAIR_LIMIT,
  SLOW_MOVERS_LIMIT,
  TOP_CUSTOMERS_LIMIT,
  EVENT_SAMPLE_RATE,
  RFM_RECENCY_DAYS_HIGH,
  RFM_RECENCY_DAYS_MED,
  RFM_FREQUENCY_HIGH,
  RFM_FREQUENCY_MED,
}

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

// ─── Affinity product limit (unique to this file) ─────────────────────────────

export const AFFINITY_PRODUCT_LIMIT = 5
