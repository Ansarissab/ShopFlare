'use client'

import { useEffect, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { en } from '@/lib/i18n/en'
import { formatPrice } from '@/lib/utils/index'
import { apiGet } from '@/lib/api'
import type {
  AnalyticsProductsResponse,
  AnalyticsProductLeaderboardRow,
} from '@/lib/types/analytics'

type SortKey = 'revenue' | 'units' | 'orders'

function sorted(rows: AnalyticsProductLeaderboardRow[], key: SortKey) {
  return [...rows].sort((a, b) => {
    if (key === 'revenue') return b.revenueCents - a.revenueCents
    if (key === 'units')   return b.unitsSold - a.unitsSold
    return b.orders - a.orders
  })
}

function TabSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-64 rounded-xl" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
      <Skeleton className="h-40 rounded-xl" />
    </div>
  )
}

export function ProductsTab({ period }: { period: string }) {
  const [data, setData]       = useState<AnalyticsProductsResponse | null>(null)
  // Track which period `data` belongs to. While it differs from the current
  // `period` prop we are loading — derived during render, so no synchronous
  // setState in the effect (the only setState runs post-fetch, asynchronously).
  const [loadedPeriod, setLoadedPeriod] = useState<string | null>(null)
  const [sort, setSort]       = useState<SortKey>('revenue')

  const loading = loadedPeriod !== period

  useEffect(() => {
    let active = true
    apiGet<AnalyticsProductsResponse>(`/api/admin/analytics/products?period=${period}`)
      .then(d => { if (active) setData(d) })
      .catch(() => { if (active) setData(null) })
      .finally(() => { if (active) setLoadedPeriod(period) })
    return () => { active = false }
  }, [period])

  if (loading) return <TabSkeleton />
  if (!data)   return <p className="text-sm text-muted-foreground">{en.admin.analyticsNoData}</p>

  const leaderboard = sorted(data.leaderboard.slice(0, 50), sort)

  return (
    <div className="flex flex-col gap-4">

      {/* ── Product Leaderboard ─────────────────────────────────────────── */}
      <div className="flex flex-col rounded-xl border">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <p className="text-sm font-semibold">{en.admin.analyticsLeaderboard}</p>
          <div className="flex gap-1">
            {(['revenue', 'units', 'orders'] as SortKey[]).map(k => (
              <Button
                key={k}
                size="sm"
                variant={sort === k ? 'default' : 'outline'}
                className="text-xs"
                onClick={() => setSort(k)}
              >
                {k === 'revenue' ? en.admin.totalRevenue
                  : k === 'units' ? en.admin.analyticsUnitsSold
                  : en.admin.analyticsOrders}
              </Button>
            ))}
          </div>
        </div>
        {leaderboard.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">{en.admin.analyticsNoData}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="w-8 px-2 sm:px-5 py-2 text-left font-medium">#</th>
                  <th className="px-2 sm:px-5 py-2 text-left font-medium">Product</th>
                  <th className="hidden sm:table-cell px-2 sm:px-5 py-2 text-right font-medium">{en.admin.analyticsOrders}</th>
                  <th className="hidden sm:table-cell px-2 sm:px-5 py-2 text-right font-medium">{en.admin.analyticsUnitsSold}</th>
                  <th className="px-2 sm:px-5 py-2 text-right font-medium">{en.admin.totalRevenue}</th>
                  <th className="hidden md:table-cell px-2 sm:px-5 py-2 text-right font-medium">{en.admin.analyticsAov}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {leaderboard.map((row, i) => (
                  <tr key={row.productId} className="hover:bg-muted/40">
                    <td className="px-2 sm:px-5 py-3 text-xs text-muted-foreground tabular-nums">{i + 1}</td>
                    <td className="px-2 sm:px-5 py-3 font-medium truncate min-w-0">{row.productName}</td>
                    <td className="hidden sm:table-cell px-2 sm:px-5 py-3 text-right tabular-nums">{row.orders}</td>
                    <td className="hidden sm:table-cell px-2 sm:px-5 py-3 text-right tabular-nums">{row.unitsSold}</td>
                    <td className="px-2 sm:px-5 py-3 text-right font-semibold tabular-nums whitespace-nowrap">
                      {formatPrice(row.revenueCents)}
                    </td>
                    <td className="hidden md:table-cell px-2 sm:px-5 py-3 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                      {formatPrice(row.aovCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Variant + Size breakdown ────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* By Variant */}
        <div className="flex flex-col rounded-xl border">
          <div className="border-b px-5 py-4">
            <p className="text-sm font-semibold">{en.admin.analyticsVariantBreakdown}</p>
          </div>
          {data.variants.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">{en.admin.analyticsNoData}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="px-5 py-2 text-left font-medium">Variant</th>
                    <th className="hidden sm:table-cell px-5 py-2 text-right font-medium">{en.admin.analyticsUnitsSold}</th>
                    <th className="px-5 py-2 text-right font-medium">{en.admin.totalRevenue}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.variants.map(v => (
                    <tr key={v.variantId} className="hover:bg-muted/40">
                      <td className="flex items-center gap-2 px-5 py-3">
                        {v.colorHex && (
                          <span
                            className="inline-block h-3 w-3 shrink-0 rounded-full border"
                            style={{ background: v.colorHex }}
                          />
                        )}
                        <span>{v.variantLabel}</span>
                      </td>
                      <td className="hidden sm:table-cell px-5 py-3 text-right tabular-nums">{v.unitsSold}</td>
                      <td className="px-5 py-3 text-right font-semibold tabular-nums whitespace-nowrap">
                        {formatPrice(v.revenueCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* By Size */}
        <div className="flex flex-col rounded-xl border">
          <div className="border-b px-5 py-4">
            <p className="text-sm font-semibold">{en.admin.analyticsSizeBreakdown}</p>
          </div>
          {data.sizes.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">{en.admin.analyticsNoData}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="px-5 py-2 text-left font-medium">Size</th>
                    <th className="hidden sm:table-cell px-5 py-2 text-right font-medium">{en.admin.analyticsUnitsSold}</th>
                    <th className="px-5 py-2 text-right font-medium">{en.admin.totalRevenue}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.sizes.map(s => (
                    <tr key={s.sizeOptionId} className="hover:bg-muted/40">
                      <td className="px-5 py-3">{s.size}</td>
                      <td className="hidden sm:table-cell px-5 py-3 text-right tabular-nums">{s.unitsSold}</td>
                      <td className="px-5 py-3 text-right font-semibold tabular-nums whitespace-nowrap">
                        {formatPrice(s.revenueCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Slow / Never Sold ───────────────────────────────────────────── */}
      {data.slowMovers.length > 0 && (
        <div className="flex flex-col rounded-xl border">
          <div className="border-b px-5 py-4">
            <p className="text-sm font-semibold">{en.admin.analyticsSlowMovers}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="px-5 py-2 text-left font-medium">Product</th>
                  <th className="hidden sm:table-cell px-5 py-2 text-right font-medium">{en.admin.analyticsUnitsSold}</th>
                  <th className="hidden sm:table-cell px-5 py-2 text-right font-medium">{en.admin.analyticsStockOnHand}</th>
                  <th className="px-5 py-2 text-right font-medium">{en.admin.analyticsTurnover}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.slowMovers.map(m => (
                  <tr key={m.productId} className="hover:bg-muted/40">
                    <td className="px-5 py-3 font-medium truncate min-w-0">{m.productName}</td>
                    <td className="hidden sm:table-cell px-5 py-3 text-right tabular-nums">{m.unitsSold}</td>
                    <td className="hidden sm:table-cell px-5 py-3 text-right tabular-nums">
                      {m.unlimited ? (
                        <span className="text-muted-foreground">{en.admin.analyticsUnlimited}</span>
                      ) : m.stockOnHand}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">
                      {m.turnoverRatio.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
