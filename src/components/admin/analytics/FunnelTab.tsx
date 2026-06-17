'use client'

import { useState, useEffect } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { StatCard } from '@/components/admin/shared/StatCard'
import { HelpTip } from '@/components/common/HelpTip'
import { useT } from '@/lib/i18n/Provider'
import { apiGet } from '@/lib/api'
import { formatPrice } from '@/lib/utils/index'
import type { AnalyticsFunnelResponse, FunnelTabProps } from '@/lib/types/analytics'
import type { Dictionary } from '@/lib/i18n/index'

// Maps API stage keys to i18n labels for layer-2 stages.
// NOTE: was module-scope referencing en.; converted to accept t as parameter.
function layer2Label(stage: string, t: Dictionary): string {
  switch (stage) {
    case 'product_view':
      return t.admin.analyticsFunnelViews
    case 'add_to_cart':
      return t.admin.analyticsFunnelAddToCart
    case 'checkout_start':
      return t.admin.analyticsFunnelCheckoutStart
    case 'purchase':
      return t.admin.analyticsFunnelPurchased
    default:
      return stage
  }
}

export function FunnelTab({ period }: FunnelTabProps) {
  const t = useT()
  // `loaded` holds the fetch result together with the period it was fetched for.
  // Deriving `loading` from a period mismatch during render (instead of a
  // synchronous setState inside the effect) avoids cascading re-renders while
  // preserving the exact behavior: skeleton shows on mount and on every period
  // change until the matching response (or failure) resolves.
  const [loaded, setLoaded] = useState<{
    period: string
    data: AnalyticsFunnelResponse | null
  } | null>(null)

  useEffect(() => {
    let active = true
    apiGet<AnalyticsFunnelResponse>(`/api/admin/analytics/funnel?period=${period}`)
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

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-6 w-48" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!data) {
    return <p className="text-sm text-muted-foreground">{t.admin.analyticsNoData}</p>
  }

  const {
    funnelStages,
    checkoutAbandonmentRatePct,
    abandonedCheckouts,
    layer2Enabled,
    layer2Stages,
    sampleRate,
  } = data

  // max count drives bar widths for layer-1 funnel
  const maxCount = Math.max(...funnelStages.map((s) => s.count), 1)
  const firstCount = funnelStages[0]?.count ?? 1

  // max count for layer-2 funnel
  const maxL2Count = layer2Enabled ? Math.max(...layer2Stages.map((s) => s.count), 1) : 1
  const firstL2Count = layer2Stages[0]?.count ?? 1

  return (
    <div className="flex flex-col gap-8">
      {/* ── Layer 1: Checkout funnel ─────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          {t.admin.analyticsFunnel}
          <HelpTip text={t.tooltips.analytics.funnel} />
        </h3>

        {funnelStages.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.admin.analyticsNoData}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {funnelStages.map((stage) => {
              const widthPct = (stage.count / maxCount) * 100
              const ofFirst = firstCount > 0 ? Math.round((stage.count / firstCount) * 100) : 0
              return (
                <div key={stage.stage} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{stage.label}</span>
                    <span className="text-muted-foreground">
                      {stage.count.toLocaleString()} &middot; {ofFirst}%
                    </span>
                  </div>
                  <div className="h-7 w-full rounded bg-muted overflow-hidden">
                    <div
                      className="h-full rounded bg-zinc-900 dark:bg-zinc-100 transition-all"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Abandonment rate stat card ───────────────────────────────────────── */}
      <div className="max-w-xs">
        <StatCard
          label={t.admin.analyticsAbandonmentRate}
          value={`${checkoutAbandonmentRatePct}% abandoned`}
          help={t.tooltips.analytics.abandonment}
        />
      </div>

      {/* ── Abandoned checkouts table ────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          {t.admin.analyticsAbandonedCheckouts}
          <HelpTip text={t.tooltips.analytics.abandoned} />
        </h3>

        {abandonedCheckouts.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.admin.analyticsNoData}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">#</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    {t.admin.analyticsCustomerName}
                  </th>
                  <th className="hidden sm:table-cell px-3 py-2 text-left font-medium text-muted-foreground">
                    {t.admin.analyticsContact}
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                    {t.admin.totalRevenue}
                  </th>
                  <th className="hidden sm:table-cell px-3 py-2 text-right font-medium text-muted-foreground" />
                </tr>
              </thead>
              <tbody>
                {abandonedCheckouts.map((row) => (
                  <tr key={row.orderNumber} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                      {row.orderNumber}
                    </td>
                    <td className="px-3 py-2">{row.customerName}</td>
                    <td className="hidden sm:table-cell px-3 py-2 text-muted-foreground">
                      {row.contactHint}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {formatPrice(row.totalCents)}
                    </td>
                    <td className="hidden sm:table-cell px-3 py-2 text-right text-xs text-muted-foreground whitespace-nowrap">
                      {t.admin.analyticsHoursAgo.replace('{n}', String(row.hoursAgo))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Layer 2: Full funnel ─────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        {!layer2Enabled ? (
          <div className="rounded-lg border border-dashed p-4 flex flex-col gap-1">
            <p className="text-sm font-medium text-muted-foreground">
              {t.admin.analyticsFunnelLayer2Off}
            </p>
            <p className="text-xs text-muted-foreground">{t.admin.analyticsFunnelLayer2Hint}</p>
          </div>
        ) : (
          <>
            {layer2Stages.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.admin.analyticsNoData}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {layer2Stages.map((stage) => {
                  const widthPct = (stage.count / maxL2Count) * 100
                  const ofFirst =
                    firstL2Count > 0 ? Math.round((stage.count / firstL2Count) * 100) : 0
                  return (
                    <div key={stage.stage} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">{layer2Label(stage.stage, t)}</span>
                        <span className="text-muted-foreground">
                          {stage.count.toLocaleString()} &middot; {ofFirst}%
                        </span>
                      </div>
                      <div className="h-7 w-full rounded bg-muted overflow-hidden">
                        <div
                          className="h-full rounded bg-zinc-900 dark:bg-zinc-100 transition-all"
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              {t.admin.analyticsSampleRateNote.replace(
                '{rate}',
                String(Math.round(sampleRate * 100)),
              )}
            </p>
          </>
        )}
      </section>
    </div>
  )
}
