import { Hono } from 'hono'
import { eq, ne, gte, and, sql } from 'drizzle-orm'
import { createDb } from 'worker/db/index'
import * as schema from 'worker/db/schema'
import type { AdminEnv } from 'worker/lib/access'

const app = new Hono<AdminEnv>()

function sinceDate(period: string): string | undefined {
  const days: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 }
  const d = days[period]
  if (!d) return undefined
  return new Date(Date.now() - d * 86_400_000).toISOString()
}

app.get('/', async (c) => {
  const period = c.req.query('period') ?? '30d'
  const db = createDb(c.env.DB)
  const since = sinceDate(period)

  const inPeriod = since ? gte(schema.orders.createdAt, since) : sql`1 = 1`
  const active = and(ne(schema.orders.status, 'cancelled'), inPeriod)

  // ─── Summary ────────────────────────────────────────────────────────────────
  const [summary] = await db
    .select({
      totalOrders:        sql<number>`COUNT(*)`,
      totalRevenueCents:  sql<number>`SUM(CASE WHEN ${schema.orders.status} != 'cancelled' THEN ${schema.orders.totalCents} ELSE 0 END)`,
      cancelledOrders:    sql<number>`SUM(CASE WHEN ${schema.orders.status} = 'cancelled' THEN 1 ELSE 0 END)`,
      deliveredOrders:    sql<number>`SUM(CASE WHEN ${schema.orders.status} = 'delivered' THEN 1 ELSE 0 END)`,
      totalDiscountCents: sql<number>`SUM(CASE WHEN ${schema.orders.status} != 'cancelled' THEN ${schema.orders.discountCents} ELSE 0 END)`,
    })
    .from(schema.orders)
    .where(inPeriod)

  // ─── Revenue by day ──────────────────────────────────────────────────────────
  const revenueByDay = await db
    .select({
      day:          sql<string>`DATE(${schema.orders.createdAt})`,
      revenueCents: sql<number>`SUM(${schema.orders.totalCents})`,
      orderCount:   sql<number>`COUNT(*)`,
    })
    .from(schema.orders)
    .where(active)
    .groupBy(sql`DATE(${schema.orders.createdAt})`)
    .orderBy(sql`DATE(${schema.orders.createdAt}) ASC`)

  // ─── Payment method breakdown ────────────────────────────────────────────────
  const paymentMethods = await db
    .select({
      method:       schema.orders.paymentMethod,
      count:        sql<number>`COUNT(*)`,
      revenueCents: sql<number>`SUM(${schema.orders.totalCents})`,
    })
    .from(schema.orders)
    .where(active)
    .groupBy(schema.orders.paymentMethod)
    .orderBy(sql`COUNT(*) DESC`)

  // ─── Top products ────────────────────────────────────────────────────────────
  const topProducts = await db
    .select({
      productId:   schema.orderItems.productId,
      productName: sql<string>`MIN(${schema.products.name})`,
      unitsSold:   sql<number>`SUM(${schema.orderItems.quantity})`,
      revenueCents: sql<number>`SUM(${schema.orderItems.quantity} * ${schema.orderItems.priceCents})`,
    })
    .from(schema.orderItems)
    .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
    .innerJoin(schema.products, eq(schema.orderItems.productId, schema.products.id))
    .where(active)
    .groupBy(schema.orderItems.productId)
    .orderBy(sql`SUM(${schema.orderItems.quantity} * ${schema.orderItems.priceCents}) DESC`)
    .limit(10)

  // ─── Coupon stats ────────────────────────────────────────────────────────────
  const couponStats = await db
    .select({
      couponCode:        schema.orders.couponCode,
      uses:              sql<number>`COUNT(*)`,
      totalDiscountCents: sql<number>`SUM(${schema.orders.discountCents})`,
    })
    .from(schema.orders)
    .where(and(active, sql`${schema.orders.couponCode} IS NOT NULL`))
    .groupBy(schema.orders.couponCode)
    .orderBy(sql`COUNT(*) DESC`)

  return c.json({ period, summary, revenueByDay, paymentMethods, topProducts, couponStats })
})

export default app
