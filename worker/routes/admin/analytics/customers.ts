import { Hono } from 'hono'
import { sql } from 'drizzle-orm'
import { createDb } from 'worker/db/index'
import * as schema from 'worker/db/schema'
import type { AdminEnv } from 'worker/lib/access'
import {
  sinceDate,
  activeOrdersFilter,
  RFM_RECENCY_DAYS_HIGH,
  RFM_RECENCY_DAYS_MED,
  RFM_FREQUENCY_HIGH,
  RFM_FREQUENCY_MED,
  TOP_CUSTOMERS_LIMIT,
} from 'worker/lib/analytics'

type RfmSegment = 'champions' | 'loyal' | 'at_risk' | 'new' | 'other'

const app = new Hono<AdminEnv>()

function maskEmail(raw: string): string {
  const at = raw.indexOf('@')
  if (at < 0) return raw.slice(0, 3) + '***'
  const local = raw.slice(0, at)
  const domain = raw.slice(at)
  const visible = local.length > 2 ? local[0] + local[1] : local[0]
  return visible + '***' + domain
}

function maskPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 4) return '***'
  return raw.slice(0, 3) + '***' + raw.slice(-2)
}

app.get('/', async (c) => {
  const period = c.req.query('period') ?? '30d'
  const db = createDb(c.env.DB)
  const since = sinceDate(period)
  const active = activeOrdersFilter(since)

  // All customers in period: keyed by lower(email) with phone fallback
  const allCustomers = await db
    .select({
      customerKey: sql<string>`COALESCE(LOWER(${schema.orders.customerEmail}), ${schema.orders.customerPhone}, 'unknown')`,
      orders: sql<number>`COUNT(*)`,
      totalSpentCents: sql<number>`SUM(${schema.orders.totalCents})`,
      firstOrderAt: sql<string>`MIN(${schema.orders.createdAt})`,
      lastOrderAt: sql<string>`MAX(${schema.orders.createdAt})`,
      rawEmail: sql<string | null>`MIN(${schema.orders.customerEmail})`,
      rawPhone: sql<string | null>`MIN(${schema.orders.customerPhone})`,
    })
    .from(schema.orders)
    .where(active)
    .groupBy(
      sql`COALESCE(LOWER(${schema.orders.customerEmail}), ${schema.orders.customerPhone}, 'unknown')`,
    )
    .orderBy(sql`SUM(${schema.orders.totalCents}) DESC`)

  const totalCustomers = allCustomers.length
  const returningCustomers = allCustomers.filter((c) => c.orders > 1).length
  const repeatRatePct =
    totalCustomers > 0 ? Math.round((returningCustomers / totalCustomers) * 100) : 0
  const avgClvCents =
    totalCustomers > 0
      ? Math.round(allCustomers.reduce((s, c) => s + c.totalSpentCents, 0) / totalCustomers)
      : 0

  // RFM: classify all customers. recency = days since lastOrderAt vs now.
  const now = Date.now()
  const rfmCounts: Record<RfmSegment, number> = {
    champions: 0,
    loyal: 0,
    at_risk: 0,
    new: 0,
    other: 0,
  }

  for (const cust of allCustomers) {
    const daysSinceLast = Math.floor((now - new Date(cust.lastOrderAt).getTime()) / 86_400_000)
    const freq = cust.orders

    if (daysSinceLast <= RFM_RECENCY_DAYS_HIGH && freq >= RFM_FREQUENCY_HIGH) {
      rfmCounts.champions++
    } else if (daysSinceLast <= RFM_RECENCY_DAYS_MED && freq >= RFM_FREQUENCY_MED) {
      rfmCounts.loyal++
    } else if (daysSinceLast > RFM_RECENCY_DAYS_MED && freq >= RFM_FREQUENCY_MED) {
      rfmCounts.at_risk++
    } else if (freq === 1 && daysSinceLast <= RFM_RECENCY_DAYS_HIGH) {
      rfmCounts.new++
    } else {
      rfmCounts.other++
    }
  }

  const rfmSegments = (Object.entries(rfmCounts) as [RfmSegment, number][]).map(
    ([segment, count]) => ({ segment, count }),
  )

  // Top customers (masked)
  const topCustomers = allCustomers.slice(0, TOP_CUSTOMERS_LIMIT).map((cust) => ({
    customerKey: cust.rawEmail
      ? maskEmail(cust.rawEmail)
      : cust.rawPhone
        ? maskPhone(cust.rawPhone)
        : 'Unknown',
    orders: cust.orders,
    totalSpentCents: cust.totalSpentCents,
    firstOrderAt: cust.firstOrderAt,
    lastOrderAt: cust.lastOrderAt,
  }))

  return c.json({
    period,
    summary: { totalCustomers, returningCustomers, repeatRatePct, avgClvCents },
    topCustomers,
    rfmSegments,
  })
})

export default app
