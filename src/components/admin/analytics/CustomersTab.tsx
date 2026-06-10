'use client'

import { useEffect, useState } from 'react'
import { StatCard } from '@/components/admin/shared/StatCard'
import { Skeleton } from '@/components/ui/skeleton'
import { apiGet } from '@/lib/api'
import { formatPrice } from '@/lib/utils/index'
import { en } from '@/lib/i18n/en'
import type { AnalyticsCustomersResponse, RfmSegment } from '@/lib/types/analytics'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ─── RFM segment config ───────────────────────────────────────────────────────

const RFM_CONFIG: Record<RfmSegment, { label: string; classes: string }> = {
  champions: {
    label: en.admin.analyticsSegmentChampions,
    classes: 'text-green-700 bg-green-50 border-green-200',
  },
  loyal: {
    label: en.admin.analyticsSegmentLoyal,
    classes: 'text-blue-700 bg-blue-50 border-blue-200',
  },
  at_risk: {
    label: en.admin.analyticsSegmentAtRisk,
    classes: 'text-yellow-700 bg-yellow-50 border-yellow-200',
  },
  new: {
    label: en.admin.analyticsSegmentNew,
    classes: 'text-purple-700 bg-purple-50 border-purple-200',
  },
  other: {
    label: en.admin.analyticsSegmentOther,
    classes: 'text-zinc-500 bg-zinc-50 border-zinc-200',
  },
}

const RFM_ORDER: RfmSegment[] = ['champions', 'loyal', 'at_risk', 'new', 'other']

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CustomersSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-14 rounded-xl" />
      <Skeleton className="h-56 rounded-xl" />
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CustomersTab({ period }: { period: string }) {
  // `loaded` holds the fetch result together with the period it was fetched for.
  // Deriving `loading` from a period mismatch during render (instead of a
  // synchronous setState inside the effect) avoids cascading re-renders while
  // preserving the exact behavior: skeleton shows on mount and on every period
  // change until the matching response (or failure) resolves.
  const [loaded, setLoaded] = useState<{
    period: string
    data: AnalyticsCustomersResponse | null
  } | null>(null)

  useEffect(() => {
    let active = true
    apiGet<AnalyticsCustomersResponse>(`/api/admin/analytics/customers?period=${period}`)
      .then((d) => {
        if (active) setLoaded({ period, data: d })
      })
      .catch(() => {
        if (active) setLoaded({ period, data: null })
      })
    return () => {
      active = false
    }
  }, [period])

  const loading = loaded?.period !== period
  const data = loaded?.data ?? null

  if (loading) return <CustomersSkeleton />
  if (!data) {
    return <p className="text-sm text-muted-foreground">{en.admin.analyticsNoData}</p>
  }

  const { summary, topCustomers, rfmSegments } = data

  // Build a lookup so we can render in the fixed order defined above
  const rfmMap = Object.fromEntries(rfmSegments.map((s) => [s.segment, s.count])) as Record<
    RfmSegment,
    number
  >

  const returningPct =
    summary.totalCustomers > 0
      ? Math.round((summary.returningCustomers / summary.totalCustomers) * 100)
      : 0

  return (
    <>
      {/* ── Stat cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label={en.admin.analyticsTotalCustomers}
          value={summary.totalCustomers}
          help={en.tooltips.analytics.totalCustomers}
        />
        <StatCard
          label={en.admin.analyticsReturning}
          value={summary.returningCustomers}
          sub={`${returningPct}% of total`}
          help={en.tooltips.analytics.returning}
        />
        <StatCard
          label={en.admin.analyticsRepeatRate}
          value={`${summary.repeatRatePct}%`}
          help={en.tooltips.analytics.repeatRate}
        />
        <StatCard
          label={en.admin.analyticsAvgClv}
          value={formatPrice(summary.avgClvCents)}
          help={en.tooltips.analytics.clv}
        />
      </div>

      {/* ── RFM segments ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 rounded-xl border p-5">
        <p className="text-sm font-semibold">{en.admin.analyticsRfmSegments}</p>
        <div className="flex flex-wrap gap-3">
          {RFM_ORDER.map((seg) => {
            const { label, classes } = RFM_CONFIG[seg]
            const count = rfmMap[seg] ?? 0
            return (
              <div
                key={seg}
                className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium ${classes}`}
              >
                <span>{label}</span>
                <span className="tabular-nums font-bold">{count}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Top customers table ───────────────────────────────────────────── */}
      <div className="flex flex-col rounded-xl border">
        <div className="border-b px-5 py-4">
          <p className="text-sm font-semibold">{en.admin.analyticsTopCustomers}</p>
        </div>
        {topCustomers.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">{en.admin.analyticsNoData}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="px-5 py-2 text-left font-medium">Customer</th>
                  <th className="hidden sm:table-cell px-5 py-2 text-right font-medium">
                    {en.admin.analyticsOrders}
                  </th>
                  <th className="px-5 py-2 text-right font-medium">{en.admin.analyticsSpent}</th>
                  <th className="hidden md:table-cell px-5 py-2 text-right font-medium">
                    {en.admin.analyticsFirstOrder}
                  </th>
                  <th className="hidden md:table-cell px-5 py-2 text-right font-medium">
                    {en.admin.analyticsLastOrder}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {topCustomers.map((c, i) => (
                  <tr key={i} className="hover:bg-muted/40">
                    <td className="flex items-center gap-3 px-5 py-3">
                      <span className="w-5 shrink-0 text-xs text-muted-foreground">{i + 1}</span>
                      <span className="font-mono text-xs">{c.customerKey}</span>
                    </td>
                    <td className="hidden sm:table-cell px-5 py-3 text-right tabular-nums">
                      {c.orders}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums whitespace-nowrap">
                      {formatPrice(c.totalSpentCents)}
                    </td>
                    <td className="hidden md:table-cell px-5 py-3 text-right text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                      {shortDate(c.firstOrderAt)}
                    </td>
                    <td className="hidden md:table-cell px-5 py-3 text-right text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                      {shortDate(c.lastOrderAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
