'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { StatCard } from '@/components/admin/shared/StatCard'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { en } from '@/lib/i18n/en'
import { formatPrice } from '@/lib/utils/index'
import { useApiResource } from '@/hooks/useApiResource'
import type { AdminOrdersResponse } from '@/lib/types/admin'

// ─── Chart helpers ────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  pending:    '#f59e0b',
  confirmed:  '#6366f1',
  processing: '#3b82f6',
  shipped:    '#8b5cf6',
  delivered:  '#22c55e',
  cancelled:  '#ef4444',
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

function shortDay(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Data computation ─────────────────────────────────────────────────────────

interface DashboardStats {
  total: number
  pending: number
  cancelled: number
  delivered: number
  revenueCents: number
  avgOrderCents: number
  lowStock: number
  revenueByDay: { label: string; revenue: number }[]
  statusBreakdown: { name: string; value: number; color: string }[]
  recentOrders: {
    id: string
    orderNumber: string
    customerName: string
    totalCents: number
    status: string
    createdAt: string
  }[]
}

function computeStats(data: AdminOrdersResponse | null): DashboardStats {
  if (!data) {
    return {
      total: 0, pending: 0, cancelled: 0, delivered: 0,
      revenueCents: 0, avgOrderCents: 0, lowStock: 0,
      revenueByDay: [], statusBreakdown: [], recentOrders: [],
    }
  }

  const orders = data.orders
  const pending   = orders.filter(o => o.status === 'pending').length
  const cancelled = orders.filter(o => o.status === 'cancelled').length
  const delivered = orders.filter(o => o.status === 'delivered').length
  const active    = orders.filter(o => o.status !== 'cancelled')
  const revenueCents  = active.reduce((s, o) => s + o.totalCents, 0)
  const avgOrderCents = active.length > 0 ? Math.round(revenueCents / active.length) : 0

  // Revenue by day — last 14 days, stored as major currency unit for Y-axis readability
  const days = getLast14Days()
  const dayMap: Record<string, number> = Object.fromEntries(days.map(d => [d, 0]))
  for (const o of active) {
    const day = o.createdAt.slice(0, 10)
    if (day in dayMap) dayMap[day] += o.totalCents
  }
  const revenueByDay = days.map(d => ({
    label: shortDay(d),
    revenue: Math.round(dayMap[d] / 100),
  }))

  // Status breakdown
  const statusMap: Record<string, number> = {}
  for (const o of orders) statusMap[o.status] = (statusMap[o.status] ?? 0) + 1
  const statusBreakdown = Object.entries(statusMap)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({
      name: en.orderStatusLabels[name as keyof typeof en.orderStatusLabels] ?? name,
      value,
      color: STATUS_COLORS[name] ?? '#71717a',
    }))

  // Most recent 5 orders
  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)

  return {
    total: data.total, pending, cancelled, delivered,
    revenueCents, avgOrderCents, lowStock: 0,
    revenueByDay, statusBreakdown, recentOrders,
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const { data, loading } = useApiResource<AdminOrdersResponse>('/api/admin/orders?limit=200')
  const stats = computeStats(data)

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{en.admin.dashboard}</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/products/new" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
            {en.admin.addProduct}
          </Link>
          <Link href="/admin/pos" className={cn(buttonVariants({ size: 'sm' }))}>
            {en.admin.pos}
          </Link>
        </div>
      </div>

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
              label={en.admin.totalOrders}
              value={stats.total}
              sub={`${stats.cancelled} cancelled · ${stats.delivered} delivered`}
              help={en.tooltips.dashboard.totalOrders}
            />
            <StatCard
              label={en.admin.totalRevenue}
              value={formatPrice(stats.revenueCents)}
              sub={`excl. cancelled · avg ${formatPrice(stats.avgOrderCents)}/order`}
              help={en.tooltips.dashboard.revenue}
            />
            <StatCard
              label={en.admin.pendingOrders}
              value={stats.pending}
              sub={stats.pending > 0 ? 'need attention' : 'all caught up'}
              help={en.tooltips.dashboard.pending}
            />
            <StatCard
              label={en.admin.lowStockAlert}
              value={stats.lowStock}
              sub="variants below threshold"
              href="/admin/products"
            />
          </div>

          {/* ── Charts ───────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Revenue area chart */}
            <div className="flex flex-col gap-4 rounded-xl border p-5 lg:col-span-2">
              <p className="text-sm font-semibold">{en.admin.revenueChart}</p>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart
                  data={stats.revenueByDay}
                  margin={{ top: 4, right: 4, left: -16, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#18181b" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="#18181b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#71717a' }}
                    tickLine={false}
                    axisLine={false}
                    interval={1}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#71717a' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={v => (v === 0 ? '0' : `${v}`)}
                  />
                  <Tooltip
                    formatter={(val) => [formatPrice(Number(val) * 100), 'Revenue']}
                    contentStyle={{
                      fontSize: 12,
                      border: '1px solid #e4e4e7',
                      borderRadius: 8,
                      boxShadow: '0 1px 4px rgba(0,0,0,.06)',
                    }}
                    labelStyle={{ fontWeight: 600, marginBottom: 2 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#18181b"
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
              <p className="text-sm font-semibold">{en.admin.ordersChart}</p>
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
                      contentStyle={{
                        fontSize: 12,
                        border: '1px solid #e4e4e7',
                        borderRadius: 8,
                        boxShadow: '0 1px 4px rgba(0,0,0,.06)',
                      }}
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
                  {en.admin.noOrdersYet}
                </div>
              )}
            </div>
          </div>

          {/* ── Recent Orders ─────────────────────────────────────────────── */}
          <div className="flex flex-col gap-2 rounded-xl border">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <p className="text-sm font-semibold">{en.admin.recentOrders}</p>
              <Link
                href="/admin/orders"
                className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {en.common.viewAll}
                <ArrowRight className="size-3" />
              </Link>
            </div>

            {stats.recentOrders.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">{en.admin.noOrdersYet}</p>
            ) : (
              <div className="flex flex-col divide-y">
                {stats.recentOrders.map(o => (
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
                      {en.orderStatusLabels[o.status as keyof typeof en.orderStatusLabels] ?? o.status}
                    </Badge>
                    <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">
                      {new Date(o.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
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
