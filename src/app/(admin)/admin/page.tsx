'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { StatCard } from '@/components/admin/shared/StatCard'
import { AdminPageHeader } from '@/components/admin/shared/AdminPageHeader'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/Provider'
import { formatPrice, shortDay } from '@/lib/utils/index'
import { CHART_TOOLTIP_STYLE } from '@/lib/constants/chart'
import { useApiResource } from '@/hooks/useApiResource'
import { useChartTheme } from '@/hooks/useChartTheme'
import type { AdminOrdersResponse, DashboardStats } from '@/lib/types/admin'
import type { Dictionary } from '@/lib/i18n/index'

// ─── Chart helpers ────────────────────────────────────────────────────────────

/**
 * Semantic status hues for the pie chart.
 * These are intentionally distinct per-status (not theme tokens) so the
 * donut segments remain identifiable. They use Tailwind-equivalent palette
 * values that work on both light and dark backgrounds.
 */
const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  confirmed: '#4A7C6F',
  processing: '#3b82f6',
  shipped: '#8b5cf6',
  delivered: '#22c55e',
  cancelled: '#ef4444',
}

function getLast14Days(): string[] {
  const days: string[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }
  return days
}

// ─── Data computation ─────────────────────────────────────────────────────────

function computeStats(data: AdminOrdersResponse | null, t: Dictionary): DashboardStats {
  if (!data) {
    return {
      total: 0,
      pending: 0,
      cancelled: 0,
      delivered: 0,
      revenueCents: 0,
      avgOrderCents: 0,
      lowStock: 0,
      revenueByDay: [],
      statusBreakdown: [],
      recentOrders: [],
    }
  }

  const orders = data.orders
  const pending = orders.filter((o) => o.status === 'pending').length
  const cancelled = orders.filter((o) => o.status === 'cancelled').length
  const delivered = orders.filter((o) => o.status === 'delivered').length
  const active = orders.filter((o) => o.status !== 'cancelled')
  const revenueCents = active.reduce((s, o) => s + o.totalCents, 0)
  const avgOrderCents = active.length > 0 ? Math.round(revenueCents / active.length) : 0

  // Revenue by day — last 14 days, stored as major currency unit for Y-axis readability
  const days = getLast14Days()
  const dayMap: Record<string, number> = Object.fromEntries(days.map((d) => [d, 0]))
  for (const o of active) {
    const day = o.createdAt.slice(0, 10)
    if (day in dayMap) dayMap[day] += o.totalCents
  }
  const revenueByDay = days.map((d) => ({
    label: shortDay(d),
    revenue: Math.round(dayMap[d] / 100),
  }))

  // Status breakdown
  const statusMap: Record<string, number> = {}
  for (const o of orders) statusMap[o.status] = (statusMap[o.status] ?? 0) + 1
  const statusBreakdown = Object.entries(statusMap)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({
      name: t.orderStatusLabels[name as keyof typeof t.orderStatusLabels] ?? name,
      value,
      color: STATUS_COLORS[name] ?? '#6B6B62',
    }))

  // Most recent 5 orders
  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)

  return {
    total: data.total,
    pending,
    cancelled,
    delivered,
    revenueCents,
    avgOrderCents,
    lowStock: 0,
    revenueByDay,
    statusBreakdown,
    recentOrders,
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const t = useT()
  const chart = useChartTheme()
  const { data, loading } = useApiResource<AdminOrdersResponse>('/api/admin/orders?limit=200')
  const stats = computeStats(data, t)

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader
        title={t.admin.dashboard}
        actions={
          <>
            <Link
              href="/admin/products/new"
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            >
              {t.admin.addProduct}
            </Link>
            <Link href="/admin/pos" className={cn(buttonVariants({ size: 'sm' }))}>
              {t.admin.pos}
            </Link>
          </>
        }
      />

      {loading ? (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Skeleton className="h-64 rounded-xl lg:col-span-2" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
          <Skeleton className="h-56 rounded-xl" />
        </div>
      ) : (
        <>
          {/* ── Stat cards ───────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              label={t.admin.totalOrders}
              value={stats.total}
              sub={t.admin.statSubCancelledDelivered
                .replace('{cancelled}', String(stats.cancelled))
                .replace('{delivered}', String(stats.delivered))}
              help={t.tooltips.dashboard.totalOrders}
            />
            <StatCard
              label={t.admin.totalRevenue}
              value={formatPrice(stats.revenueCents)}
              sub={t.admin.statSubRevenueAvg.replace('{avg}', formatPrice(stats.avgOrderCents))}
              help={t.tooltips.dashboard.revenue}
              mono
            />
            <StatCard
              label={t.admin.pendingOrders}
              value={stats.pending}
              sub={stats.pending > 0 ? t.admin.statSubNeedAttention : t.admin.statSubAllCaughtUp}
              help={t.tooltips.dashboard.pending}
            />
            <StatCard
              label={t.admin.lowStockAlert}
              value={stats.lowStock}
              sub={t.admin.statSubVariantsBelow}
              href="/admin/products"
            />
          </div>

          {/* ── Charts ───────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Revenue area chart */}
            <div className="flex flex-col gap-4 rounded-xl border p-5 lg:col-span-2">
              <p className="text-sm font-semibold">{t.admin.revenueChart}</p>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart
                  data={stats.revenueByDay}
                  margin={{ top: 4, right: 4, left: -16, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chart.fg} stopOpacity={0.12} />
                      <stop offset="95%" stopColor={chart.fg} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chart.border} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: chart.mutedFg }}
                    tickLine={false}
                    axisLine={false}
                    interval={1}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: chart.mutedFg }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => (v === 0 ? '0' : `${v}`)}
                  />
                  <Tooltip
                    formatter={(val) => [formatPrice(Number(val) * 100), t.admin.revenueLabel]}
                    contentStyle={CHART_TOOLTIP_STYLE}
                    labelStyle={{ fontWeight: 600, marginBottom: 2 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke={chart.fg}
                    strokeWidth={2}
                    fill="url(#revGrad)"
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Order status donut */}
            <div className="flex flex-col gap-4 rounded-xl border p-5">
              <p className="text-sm font-semibold">{t.admin.ordersChart}</p>
              {stats.statusBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={stats.statusBreakdown}
                      cx="50%"
                      cy="42%"
                      innerRadius={52}
                      outerRadius={80}
                      dataKey="value"
                      paddingAngle={2}
                    >
                      {stats.statusBreakdown.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val, name) => [val, name]}
                      contentStyle={CHART_TOOLTIP_STYLE}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                  {t.admin.noOrdersYet}
                </div>
              )}
            </div>
          </div>

          {/* ── Recent Orders ─────────────────────────────────────────────── */}
          <div className="flex flex-col gap-2 rounded-xl border">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <p className="text-sm font-semibold">{t.admin.recentOrders}</p>
              <Link
                href="/admin/orders"
                className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {t.common.viewAll}
                <ArrowRight className="size-3" />
              </Link>
            </div>

            {stats.recentOrders.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">{t.admin.noOrdersYet}</p>
            ) : (
              <div className="flex flex-col divide-y">
                {stats.recentOrders.map((o) => (
                  <Link
                    key={o.id}
                    href={`/admin/orders/${o.id}`}
                    className="flex flex-col gap-1 px-5 py-3.5 text-sm transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:gap-4"
                  >
                    <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground">
                      {o.orderNumber}
                    </span>
                    <span className="flex-1 truncate font-medium">{o.customerName}</span>
                    <span className="shrink-0 font-semibold">{formatPrice(o.totalCents)}</span>
                    <Badge variant="secondary" className="capitalize shrink-0">
                      {t.orderStatusLabels[o.status as keyof typeof t.orderStatusLabels] ??
                        o.status}
                    </Badge>
                    <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">
                      {new Date(o.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
