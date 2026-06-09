// Shared health probe types — used by worker/lib/health.ts and the /status SSR page.
// Keep this file free of CF-runtime imports so the frontend tsconfig can resolve it.

export type CheckResult = { ok: boolean; latencyMs: number; error?: string }
export type HealthReport = {
  checks: { db: CheckResult; kv: CheckResult; r2: CheckResult }
  overall: 'ok' | 'degraded'
  ts: string
}
