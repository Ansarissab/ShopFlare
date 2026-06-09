import type { Metadata } from 'next'
import { fetchFromWorker } from '@/lib/server/fetchFromWorker'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { en } from '@/lib/i18n/en'
import { cn } from '@/lib/utils'
import { layout } from '@/lib/styles'
import type { HealthReport } from '@/lib/types/health'
import type { StoreConfig } from '@/lib/types/common'

export async function generateMetadata(): Promise<Metadata> {
  const config = await fetchFromWorker<StoreConfig>('/api/config/store', { revalidate: 300 })
  return buildPageMetadata({
    title: en.status.title,
    description: en.status.description,
    storeName: config?.storeName,
  })
}

const SERVICE_LABELS: Record<string, string> = {
  db: en.status.service.database,
  kv: en.status.service.storage,
  r2: en.status.service.media,
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
}: {
  name: string
  ok: boolean
  latencyMs: number
  error?: string
}) {
  const label = ok
    ? en.status.latency.replace('{ms}', String(latencyMs))
    : (error ?? en.status.checkFailed)

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
          {ok ? en.status.up : en.status.down}
        </span>
      </div>
    </div>
  )
}

export default async function StatusPage() {
  // allowNonOk: a 503 body is a valid degraded HealthReport — read it rather than discarding.
  const report = await fetchFromWorker<HealthReport>('/healthz', {
    revalidate: false,
    allowNonOk: true,
  })

  const isOk = report?.overall === 'ok'

  const lastChecked = report?.ts
    ? new Date(report.ts).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : null

  return (
    <div className={cn(layout.detailPage, 'max-w-2xl')}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{en.status.title}</h1>
        {lastChecked && (
          <p className="mt-1 text-xs text-muted-foreground">
            {en.status.lastChecked.replace('{time}', lastChecked)}
          </p>
        )}
      </div>

      <div
        className={cn(
          'flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium',
          isOk
            ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300'
            : 'border-destructive/30 bg-destructive/5 text-destructive',
        )}
      >
        <StatusDot ok={isOk} />
        {isOk ? en.status.allOperational : en.status.degraded}
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
              />
            ),
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{en.status.checkFailed}</p>
      )}
    </div>
  )
}
