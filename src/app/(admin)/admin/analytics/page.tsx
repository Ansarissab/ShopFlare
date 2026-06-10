'use client'

import { useEffect, useState } from 'react'
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
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ProductsTab } from '@/components/admin/analytics/ProductsTab'
import { CustomersTab } from '@/components/admin/analytics/CustomersTab'
import { FunnelTab } from '@/components/admin/analytics/FunnelTab'
import { en } from '@/lib/i18n/en'
import { formatPrice } from '@/lib/utils/index'
import { apiGet } from '@/lib/api'
import type { AnalyticsResponse } from '@/lib/types/analytics'
import type { AnalyticsPeriod } from '@/lib/constants'

// ─── Constants ────────────────────────────────────────────────────────────────

const PERIODS: { value: AnalyticsPeriod; label: string }[] = [
  { value: '7d', label: en.admin.analyticsPeriod7d },
  { value: '30d', label: en.admin.analyticsPeriod30d },
  { value: '90d', label: en.admin.analyticsPeriod90d },
  { value: 'all', label: en.admin.analyticsPeriodAll },
]

const PAYMENT_LABELS: Record<string, string> = {
  cod: 'Cash on Delivery',
  stripe_checkout: 'Card (Stripe)',
  bank_transfer: 'Bank Transfer',
  whatsapp: 'WhatsApp',
  in_person_cash: 'In-Person Cash',
}

const METHOD_COLORS = ['#18181b', '#6366f1', '#f59e0b', '#22c55e', '#ef4444']

const TOOLTIP_STYLE = {
  fontSize: 12,
  border: '1px solid #e4e4e7',
  borderRadius: 8,
  boxShadow: '0 1px 4px rgba(0,0,0,.06)',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortDay(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function avgOrderCents(summary: AnalyticsResponse['summary']): number {
  const active = summary.totalOrders - summary.cancelledOrders
  return active > 0 ? Math.round(summary.totalRevenueCents / active) : 0
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-xl lg:col-span-2" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
      <Skeleton className="h-56 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
    </div>
  )
}

// ─── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab({ period }: { period: AnalyticsPeriod }) {
  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  // Reset to the loading state synchronously during render whenever `period`
  // changes (incl. first render). Avoids a synchronous setState in the effect
  // while preserving the skeleton-on-refetch behavior.
  const [loadedPeriod, setLoadedPeriod] = useState<AnalyticsPeriod | null>(null)
  if (loadedPeriod !== period) {
    setLoadedPeriod(period)
    if (!loading) setLoading(true)
  }

  useEffect(() => {
    apiGet<AnalyticsResponse>(`/api/admin/analytics?period=${period}`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [period])

  if (loading) return <OverviewSkeleton />
  if (!data) return <p className="text-sm text-muted-foreground">{en.admin.analyticsNoData}</p>

  return (
    <>
      {/* ── Stat cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label={en.admin.totalRevenue}
          value={formatPrice(data.summary.totalRevenueCents)}
          sub={`${data.summary.totalOrders} orders total`}
          help={en.tooltips.analytics.revenue}
        />
        <StatCard
          label={en.admin.totalOrders}
          value={data.summary.totalOrders - data.summary.cancelledOrders}
          sub={`${data.summary.cancelledOrders} cancelled`}
          help={en.tooltips.analytics.orders}
        />
        <StatCard
          label={en.admin.analyticsAvgOrder}
          value={formatPrice(avgOrderCents(data.summary))}
          sub={`${data.summary.deliveredOrders} delivered`}
          help={en.tooltips.analytics.aov}
        />
        <StatCard
          label={en.admin.analyticsDiscountsGiven}
          value={formatPrice(data.summary.totalDiscountCents)}
          sub={`${data.couponStats.length} coupons used`}
          help={en.tooltips.analytics.discounts}
        />
      </div>

      {/* ── Revenue trend + Payment methods ────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-3 rounded-xl border p-5 lg:col-span-2">
          <p className="text-sm font-semibold">{en.admin.analyticsRevenueTrend}</p>
          {data.revenueByDay.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              {en.admin.analyticsNoData}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart
                data={data.revenueByDay.map((d) => ({
                  label: shortDay(d.day),
                  revenue: d.revenueCents,
                  orders: d.orderCount,
                }))}
                margin={{ top: 4, right: 4, left: -16, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="analyticsRevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#18181b" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#18181b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#71717a' }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#71717a' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => (v === 0 ? '0' : formatPrice(v))}
                />
                <Tooltip
                  formatter={(val, name) =>
                    name === 'revenue'
                      ? [formatPrice(Number(val)), 'Revenue']
                      : [Number(val), 'Orders']
                  }
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={{ fontWeight: 600, marginBottom: 2 }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#18181b"
                  strokeWidth={2}
                  fill="url(#analyticsRevGrad)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="flex flex-col gap-3 rounded-xl border p-5">
          <p className="text-sm font-semibold">{en.admin.analyticsPaymentMethods}</p>
          {data.paymentMethods.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              {en.admin.analyticsNoData}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={data.paymentMethods.map((m) => ({
                    name: PAYMENT_LABELS[m.method] ?? m.method,
                    value: m.count,
                  }))}
                  cx="50%"
                  cy="40%"
                  innerRadius={48}
                  outerRadius={76}
                  dataKey="value"
                  paddingAngle={2}
                >
                  {data.paymentMethods.map((_, i) => (
                    <Cell key={i} fill={METHOD_COLORS[i % METHOD_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val, name) => [Number(val), String(name)]}
                  contentStyle={TOOLTIP_STYLE}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Top products ───────────────────────────────────────────────── */}
      <div className="flex flex-col rounded-xl border">
        <div className="border-b px-5 py-4">
          <p className="text-sm font-semibold">{en.admin.analyticsTopProducts}</p>
        </div>
        {data.topProducts.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">{en.admin.analyticsNoData}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="px-2 sm:px-5 py-2 text-left font-medium">Product</th>
                  <th className="hidden sm:table-cell px-2 sm:px-5 py-2 text-right font-medium">
                    {en.admin.analyticsUnitsSold}
                  </th>
                  <th className="px-2 sm:px-5 py-2 text-right font-medium">
                    {en.admin.totalRevenue}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.topProducts.map((p, i) => (
                  <tr key={p.productId} className="hover:bg-muted/40">
                    <td className="flex items-center gap-3 px-2 sm:px-5 py-3">
                      <span className="w-5 shrink-0 text-xs text-muted-foreground">{i + 1}</span>
                      <span className="font-medium truncate min-w-0">{p.productName}</span>
                    </td>
                    <td className="hidden sm:table-cell px-2 sm:px-5 py-3 text-right tabular-nums">
                      {p.unitsSold}
                    </td>
                    <td className="px-2 sm:px-5 py-3 text-right font-semibold tabular-nums whitespace-nowrap">
                      {formatPrice(p.revenueCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Coupon performance ─────────────────────────────────────────── */}
      {data.couponStats.length > 0 && (
        <div className="flex flex-col rounded-xl border">
          <div className="border-b px-5 py-4">
            <p className="text-sm font-semibold">{en.admin.analyticsCoupons}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="px-2 sm:px-5 py-2 text-left font-medium">Coupon Code</th>
                  <th className="hidden sm:table-cell px-2 sm:px-5 py-2 text-right font-medium">
                    {en.admin.analyticsUses}
                  </th>
                  <th className="px-2 sm:px-5 py-2 text-right font-medium">Total Discount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.couponStats.map((c) => (
                  <tr key={c.couponCode} className="hover:bg-muted/40">
                    <td className="px-2 sm:px-5 py-3 font-mono font-medium">{c.couponCode}</td>
                    <td className="hidden sm:table-cell px-2 sm:px-5 py-3 text-right tabular-nums">
                      {c.uses}
                    </td>
                    <td className="px-2 sm:px-5 py-3 text-right font-semibold tabular-nums whitespace-nowrap text-success">
                      -{formatPrice(c.totalDiscountCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminAnalyticsPage() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('30d')

  const periodSelector = (
    <div className="flex gap-1">
      {PERIODS.map((p) => (
        <Button
          key={p.value}
          size="sm"
          variant={period === p.value ? 'default' : 'outline'}
          onClick={() => setPeriod(p.value)}
          className="text-xs"
        >
          {p.label}
        </Button>
      ))}
    </div>
  )

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={en.admin.analytics} actions={periodSelector} />

      <Tabs defaultValue="overview">
        <TabsList variant="line">
          <TabsTrigger value="overview">{en.admin.analyticsTabOverview}</TabsTrigger>
          <TabsTrigger value="products">{en.admin.analyticsTabProducts}</TabsTrigger>
          <TabsTrigger value="customers">{en.admin.analyticsTabCustomers}</TabsTrigger>
          <TabsTrigger value="funnel">{en.admin.analyticsTabFunnel}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="flex flex-col gap-6 pt-4">
          <OverviewTab period={period} />
        </TabsContent>

        <TabsContent value="products" className="flex flex-col gap-6 pt-4">
          <ProductsTab period={period} />
        </TabsContent>

        <TabsContent value="customers" className="flex flex-col gap-6 pt-4">
          <CustomersTab period={period} />
        </TabsContent>

        <TabsContent value="funnel" className="flex flex-col gap-6 pt-4">
          <FunnelTab period={period} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
