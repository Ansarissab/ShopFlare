import { Hono } from 'hono'
import { sql } from 'drizzle-orm'
import { createDb } from 'worker/db/index'
import * as schema from 'worker/db/schema'
import type { AdminEnv } from 'worker/lib/access'
import { sinceDate, periodFilter, ABANDONMENT_HOURS, EVENT_SAMPLE_RATE } from 'worker/lib/analytics'
const FUNNEL_METRICS = ['product_view', 'add_to_cart', 'checkout_start', 'purchase'] as const

const app = new Hono<AdminEnv>()

app.get('/', async (c) => {
  const period = c.req.query('period') ?? '30d'
  const db = createDb(c.env.DB)
  const since = sinceDate(period)
  const inPeriod = periodFilter(since)

  // ─── Layer 1: checkout abandonment from existing orders ───────────────────

  // Orders placed (incl. pending) vs confirmed vs delivered
  const [stageCounts] = await db
    .select({
      checkoutsCreated: sql<number>`COUNT(*)`,
      confirmed: sql<number>`SUM(CASE WHEN ${schema.orders.status} NOT IN ('pending','cancelled') THEN 1 ELSE 0 END)`,
      delivered: sql<number>`SUM(CASE WHEN ${schema.orders.status} = 'delivered' THEN 1 ELSE 0 END)`,
    })
    .from(schema.orders)
    .where(sql`${schema.orders.status} != 'cancelled' AND ${inPeriod}`)

  const abandHours = ABANDONMENT_HOURS
  const abandonCutoff = new Date(Date.now() - abandHours * 3_600_000).toISOString()

  // Abandoned: pending orders older than N hours, not yet progressed
  const abandonedRows = await db
    .select({
      orderNumber: schema.orders.orderNumber,
      customerName: schema.orders.customerName,
      customerEmail: schema.orders.customerEmail,
      customerPhone: schema.orders.customerPhone,
      totalCents: schema.orders.totalCents,
      createdAt: schema.orders.createdAt,
    })
    .from(schema.orders)
    .where(sql`
      ${schema.orders.status} = 'pending'
      AND ${schema.orders.createdAt} < ${abandonCutoff}
      AND ${inPeriod}
    `)
    .orderBy(sql`${schema.orders.createdAt} DESC`)
    .limit(20)

  const now = Date.now()
  const abandonedCheckouts = abandonedRows.map((r) => {
    const hoursAgo = Math.floor((now - new Date(r.createdAt).getTime()) / 3_600_000)
    const contactHint = r.customerEmail
      ? maskContact(r.customerEmail, 'email')
      : r.customerPhone
        ? maskContact(r.customerPhone, 'phone')
        : '—'
    return {
      orderNumber: r.orderNumber,
      customerName: r.customerName,
      contactHint,
      totalCents: r.totalCents,
      createdAt: r.createdAt,
      hoursAgo,
    }
  })

  const created = stageCounts?.checkoutsCreated ?? 0
  const confirmed = stageCounts?.confirmed ?? 0
  const checkoutAbandonmentRatePct =
    created > 0 ? Math.round(((created - confirmed) / created) * 100) : 0

  const funnelStages = [
    { stage: 'checkouts_created', label: 'Checkouts Created', count: created },
    { stage: 'confirmed', label: 'Confirmed', count: confirmed },
    { stage: 'delivered', label: 'Delivered', count: stageCounts?.delivered ?? 0 },
  ]

  // ─── Layer 2: daily rollup counters (if rows exist in analytics_daily) ────

  const dailyRows = await db
    .select({
      metric: schema.analyticsDaily.metric,
      count: sql<number>`SUM(${schema.analyticsDaily.count})`,
    })
    .from(schema.analyticsDaily)
    .where(since ? sql`${schema.analyticsDaily.date} >= DATE(${since})` : sql`1=1`)
    .groupBy(schema.analyticsDaily.metric)

  const layer2Enabled = dailyRows.length > 0
  const layer2Map = Object.fromEntries(dailyRows.map((r) => [r.metric, r.count]))

  const layer2Stages = FUNNEL_METRICS.map((metric) => ({
    stage: metric,
    label: metric,
    count: layer2Map[metric] ?? 0,
  }))

  return c.json({
    period,
    funnelStages,
    checkoutAbandonmentRatePct,
    abandonedCheckouts,
    layer2Enabled,
    layer2Stages,
    sampleRate: EVENT_SAMPLE_RATE,
  })
})

function maskContact(val: string, type: 'email' | 'phone'): string {
  if (type === 'email') {
    const at = val.indexOf('@')
    if (at < 0) return val.slice(0, 3) + '***'
    return val[0] + '***' + val.slice(at)
  }
  return val.slice(0, 3) + '***' + val.slice(-2)
}

export default app
