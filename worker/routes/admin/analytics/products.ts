import { Hono } from 'hono'
import { eq, sql } from 'drizzle-orm'
import { createDb } from 'worker/db/index'
import * as schema from 'worker/db/schema'
import type { AdminEnv } from 'worker/lib/access'
import {
  sinceDate,
  activeOrdersFilter,
  SLOW_MOVERS_LIMIT,
  AFFINITY_PRODUCT_LIMIT,
} from 'worker/lib/analytics'

const app = new Hono<AdminEnv>()

// ─── Store-wide product analytics ─────────────────────────────────────────────

app.get('/', async (c) => {
  const period = c.req.query('period') ?? '30d'
  const db = createDb(c.env.DB)
  const since = sinceDate(period)
  const active = activeOrdersFilter(since)

  // Leaderboard: distinct order count, units, revenue, AOV
  const leaderboard = await db
    .select({
      productId:    schema.orderItems.productId,
      productName:  sql<string>`MIN(${schema.products.name})`,
      orders:       sql<number>`COUNT(DISTINCT ${schema.orderItems.orderId})`,
      unitsSold:    sql<number>`SUM(${schema.orderItems.quantity})`,
      revenueCents: sql<number>`SUM(${schema.orderItems.quantity} * ${schema.orderItems.priceCents})`,
    })
    .from(schema.orderItems)
    .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
    .innerJoin(schema.products, eq(schema.orderItems.productId, schema.products.id))
    .where(active)
    .groupBy(schema.orderItems.productId)
    .orderBy(sql`SUM(${schema.orderItems.quantity} * ${schema.orderItems.priceCents}) DESC`)
    .limit(50)

  const leaderboardWithAov = leaderboard.map(r => ({
    ...r,
    aovCents: r.orders > 0 ? Math.round(r.revenueCents / r.orders) : 0,
  }))

  // Variant breakdown: which color sells most
  const variants = await db
    .select({
      variantId:    schema.orderItems.variantId,
      variantLabel: sql<string>`MIN(${schema.variants.label})`,
      colorHex:     sql<string | null>`MIN(${schema.variants.colorHex})`,
      unitsSold:    sql<number>`SUM(${schema.orderItems.quantity})`,
      revenueCents: sql<number>`SUM(${schema.orderItems.quantity} * ${schema.orderItems.priceCents})`,
    })
    .from(schema.orderItems)
    .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
    .innerJoin(schema.variants, eq(schema.orderItems.variantId, schema.variants.id))
    .where(active)
    .groupBy(schema.orderItems.variantId)
    .orderBy(sql`SUM(${schema.orderItems.quantity}) DESC`)
    .limit(50)

  // Size breakdown: which size sells most
  const sizes = await db
    .select({
      sizeOptionId: schema.orderItems.sizeOptionId,
      size:         sql<string>`MIN(${schema.sizeOptions.size})`,
      unitsSold:    sql<number>`SUM(${schema.orderItems.quantity})`,
      revenueCents: sql<number>`SUM(${schema.orderItems.quantity} * ${schema.orderItems.priceCents})`,
    })
    .from(schema.orderItems)
    .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
    .innerJoin(schema.sizeOptions, eq(schema.orderItems.sizeOptionId, schema.sizeOptions.id))
    .where(active)
    .groupBy(schema.orderItems.sizeOptionId)
    .orderBy(sql`SUM(${schema.orderItems.quantity}) DESC`)
    .limit(50)

  // Slow/never-sold movers: products with lowest unit sales in period
  // LEFT JOIN so products with zero sales also appear
  const slowMovers = await db
    .select({
      productId:   schema.products.id,
      productName: schema.products.name,
      unitsSold:   sql<number>`COALESCE(SUM(${schema.orderItems.quantity}), 0)`,
      stockOnHand: sql<number>`(
        SELECT COALESCE(SUM(CASE WHEN so.stock = -1 THEN -1 ELSE so.stock END), 0)
        FROM variants v
        JOIN size_options so ON so.variant_id = v.id
        WHERE v.product_id = ${schema.products.id}
      )`,
    })
    .from(schema.products)
    .leftJoin(
      schema.orderItems,
      sql`${schema.orderItems.productId} = ${schema.products.id}
        AND EXISTS (
          SELECT 1 FROM orders o
          WHERE o.id = ${schema.orderItems.orderId}
            AND o.status != 'cancelled'
            ${since ? sql`AND o.created_at >= ${since}` : sql``}
        )`
    )
    .where(sql`${schema.products.active} = 1`)
    .groupBy(schema.products.id)
    .orderBy(sql`COALESCE(SUM(${schema.orderItems.quantity}), 0) ASC`)
    .limit(SLOW_MOVERS_LIMIT)

  const slowMoversWithCalc = slowMovers.map(r => {
    const unlimited = r.stockOnHand === -1
    const stock = unlimited ? 999 : r.stockOnHand
    return {
      ...r,
      unlimited,
      stockOnHand: unlimited ? 0 : r.stockOnHand,
      turnoverRatio: stock > 0 ? Math.round((r.unitsSold / stock) * 100) / 100 : 0,
    }
  })

  return c.json({ period, leaderboard: leaderboardWithAov, variants, sizes, slowMovers: slowMoversWithCalc })
})

// ─── Per-product analytics ────────────────────────────────────────────────────

app.get('/:productId', async (c) => {
  const productId = c.req.param('productId')
  const period = c.req.query('period') ?? '30d'
  const db = createDb(c.env.DB)
  const since = sinceDate(period)
  const active = activeOrdersFilter(since)

  // Summary: units, orders, revenue, lastSoldAt
  const [summary] = await db
    .select({
      unitsSold:    sql<number>`COALESCE(SUM(${schema.orderItems.quantity}), 0)`,
      orders:       sql<number>`COUNT(DISTINCT ${schema.orderItems.orderId})`,
      revenueCents: sql<number>`COALESCE(SUM(${schema.orderItems.quantity} * ${schema.orderItems.priceCents}), 0)`,
      lastSoldAt:   sql<string | null>`MAX(${schema.orders.createdAt})`,
    })
    .from(schema.orderItems)
    .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
    .where(sql`${schema.orderItems.productId} = ${productId} AND ${active}`)

  // Stock on hand
  const stockRows = await db
    .select({ stock: schema.sizeOptions.stock })
    .from(schema.variants)
    .innerJoin(schema.sizeOptions, eq(schema.sizeOptions.variantId, schema.variants.id))
    .where(sql`${schema.variants.productId} = ${productId} AND ${schema.sizeOptions.active} = 1`)

  const unlimited = stockRows.some(r => r.stock === -1)
  const stockOnHand = unlimited ? 0 : stockRows.reduce((s, r) => s + r.stock, 0)

  // Velocity: units sold per day
  const velocity = await db
    .select({
      day:   sql<string>`DATE(${schema.orders.createdAt})`,
      units: sql<number>`SUM(${schema.orderItems.quantity})`,
    })
    .from(schema.orderItems)
    .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
    .where(sql`${schema.orderItems.productId} = ${productId} AND ${active}`)
    .groupBy(sql`DATE(${schema.orders.createdAt})`)
    .orderBy(sql`DATE(${schema.orders.createdAt}) ASC`)

  // Affinity partners for this product
  const affinityPartners = await db
    .select({
      productId:   sql<string>`b.product_id`,
      productName: sql<string>`MIN(p.name)`,
      pairCount:   sql<number>`COUNT(DISTINCT a.order_id)`,
    })
    .from(sql`order_items a`)
    .innerJoin(sql`order_items b`, sql`a.order_id = b.order_id AND b.product_id != ${productId}`)
    .innerJoin(sql`products p`, sql`p.id = b.product_id`)
    .innerJoin(schema.orders, sql`${schema.orders.id} = a.order_id`)
    .where(sql`a.product_id = ${productId} AND ${active}`)
    .groupBy(sql`b.product_id`)
    .orderBy(sql`COUNT(DISTINCT a.order_id) DESC`)
    .limit(AFFINITY_PRODUCT_LIMIT)

  return c.json({
    productId,
    period,
    unitsSold:    summary?.unitsSold ?? 0,
    orders:       summary?.orders ?? 0,
    revenueCents: summary?.revenueCents ?? 0,
    lastSoldAt:   summary?.lastSoldAt ?? null,
    stockOnHand,
    unlimited,
    velocity,
    affinityPartners,
  })
})

export default app
