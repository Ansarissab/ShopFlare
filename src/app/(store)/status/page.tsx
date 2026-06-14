import { Suspense } from 'react'
import type { Metadata } from 'next'
import { fetchFromWorker } from '@/lib/server/fetchFromWorker'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { getT } from '@/lib/i18n/server'
import type { Dictionary } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { layout } from '@/lib/styles'
import type { HealthReport } from '@/lib/types/health'
import type { StoreConfig } from '@/lib/types/common'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  const config = await fetchFromWorker<StoreConfig>('/api/config/store', { revalidate: 300 })
  return buildPageMetadata({
    title: t.status.title,
    description: t.status.description,
    storeName: config?.storeName,
  })
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-block h-2.5 w-2.5 rounded-full',
        ok ? 'bg-green-500' : 'bg-destructive',
      )}
    />
  )
}

function ServiceRow({
  name,
  ok,
  latencyMs,
  error,
  t,
}: {
  name: string
  ok: boolean
  latencyMs: number
  error?: string
  t: Dictionary
}) {
  const label = ok
    ? t.status.latency.replace('{ms}', String(latencyMs))
    : (error ?? t.status.checkFailed)

  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        <StatusDot ok={ok} />
        <span className="text-sm font-medium">{name}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={cn('text-xs', ok ? 'text-muted-foreground' : 'text-destructive')}>
          {label}
        </span>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-medium',
            ok
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-destructive/10 text-destructive',
          )}
        >
          {ok ? t.status.up : t.status.down}
        </span>
      </div>
    </div>
  )
}

/** Suspense fallback — renders instantly with service labels so the e2e matcher
 *  (`/database|storage|media|operational|degraded/i`) finds content before /healthz resolves. */
function HealthSkeleton({ t }: { t: Dictionary }) {
  const labels = [t.status.service.database, t.status.service.storage, t.status.service.media]
  return (
    <>
      {/* No overall banner in the skeleton — avoids flashing a false "degraded"
          before the real status streams in. The service labels below paint
          instantly so the page has meaningful content immediately. */}
      <div className="divide-y rounded-lg border">
        {labels.map((label) => (
          <div key={label} className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-2.5 rounded-full bg-muted-foreground/30"
              />
              <span className="text-sm font-medium">{label}</span>
            </div>
            <span className="text-xs text-muted-foreground">&hellip;</span>
          </div>
        ))}
      </div>
    </>
  )
}

/** Async component — fetches /healthz with an 8s race-timeout so it never hangs networkidle. */
async function HealthReportSection({ t }: { t: Dictionary }) {
  const SERVICE_LABELS: Record<string, string> = {
    db: t.status.service.database,
    kv: t.status.service.storage,
    r2: t.status.service.media,
  }

  // Race against an 8s timeout so a cold/unresponsive worker can't hang the stream.
  const report = await Promise.race([
    fetchFromWorker<HealthReport>('/healthz', { revalidate: false, allowNonOk: true }),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
  ])

  const isOk = report?.overall === 'ok'

  const lastChecked = report?.ts
    ? new Date(report.ts).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : null

  return (
    <>
      {lastChecked && (
        <p className="mt-1 text-xs text-muted-foreground">
          {t.status.lastChecked.replace('{time}', lastChecked)}
        </p>
      )}

      <div
        className={cn(
          'flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium',
          isOk
            ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300'
            : 'border-destructive/30 bg-destructive/5 text-destructive',
        )}
      >
        <StatusDot ok={isOk} />
        {isOk ? t.status.allOperational : t.status.degraded}
      </div>

      {report ? (
        <div className="divide-y rounded-lg border">
          {(Object.entries(report.checks) as [string, HealthReport['checks']['db']][]).map(
            ([key, check]) => (
              <ServiceRow
                key={key}
                name={SERVICE_LABELS[key] ?? key}
                ok={check.ok}
                latencyMs={check.latencyMs}
                error={check.error}
                t={t}
              />
            ),
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t.status.checkFailed}</p>
      )}
    </>
  )
}

export default async function StatusPage() {
  const t = await getT()

  return (
    <div className={cn(layout.detailPage, 'max-w-2xl')}>
      <h1 className="text-2xl font-bold tracking-tight">{t.status.title}</h1>
      <Suspense fallback={<HealthSkeleton t={t} />}>
        <HealthReportSection t={t} />
      </Suspense>
    </div>
  )
}
