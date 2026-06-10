// Health probe — independent D1/KV/R2 checks for GET /healthz.
//
// Trade-offs:
//   D1: SELECT 1 (read-only). A synthetic write/read is omitted by default because
//       writing every 3 min burns D1 write quota for no extra signal — the query
//       path is proven without it.
//   KV: write-then-read sentinel (__health, TTL 60 s) for a true write-path signal.
//       Self-cleaning via TTL; key is namespaced with __ to avoid colliding with app keys.
//   R2: head(__health) — metadata-only, cheapest existence proof. Seeded on first
//       successful probe; persists across checks. A null result (object missing) = fail.
//
// Each check is independent: a failure in one does NOT short-circuit the others.
// healthProbe() never throws — a caught exception becomes { ok: false, error: label }.

import type { Bindings } from '../types'
import type { CheckResult, HealthReport } from '@/lib/types/health'

export type { CheckResult, HealthReport }

const TIMEOUT_MS = 1500
const SENTINEL_KEY = '__health'

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

function sanitise(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase()
    if (msg.includes('timeout')) return 'timeout'
    if (msg.includes('not found') || msg.includes('null')) return 'not_found'
  }
  return 'unreachable'
}

async function checkDb(env: Bindings): Promise<CheckResult> {
  const t0 = Date.now()
  try {
    await withTimeout(env.DB.prepare('SELECT 1').first(), TIMEOUT_MS)
    return { ok: true, latencyMs: Date.now() - t0 }
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - t0, error: sanitise(err) }
  }
}

async function checkKv(env: Bindings): Promise<CheckResult> {
  const t0 = Date.now()
  try {
    const ts = new Date().toISOString()
    await withTimeout(env.KV.put(SENTINEL_KEY, ts, { expirationTtl: 60 }), TIMEOUT_MS)
    const val = await withTimeout(env.KV.get(SENTINEL_KEY), TIMEOUT_MS)
    if (val === null) return { ok: false, latencyMs: Date.now() - t0, error: 'not_found' }
    return { ok: true, latencyMs: Date.now() - t0 }
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - t0, error: sanitise(err) }
  }
}

async function checkR2(env: Bindings): Promise<CheckResult> {
  const t0 = Date.now()
  try {
    // Seed the sentinel if it doesn't exist yet (one-time, cheap PUT).
    let head = await withTimeout(env.R2.head(SENTINEL_KEY), TIMEOUT_MS)
    if (head === null) {
      await withTimeout(
        env.R2.put(SENTINEL_KEY, 'health', { httpMetadata: { contentType: 'text/plain' } }),
        TIMEOUT_MS,
      )
      head = await withTimeout(env.R2.head(SENTINEL_KEY), TIMEOUT_MS)
    }
    if (head === null) return { ok: false, latencyMs: Date.now() - t0, error: 'not_found' }
    return { ok: true, latencyMs: Date.now() - t0 }
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - t0, error: sanitise(err) }
  }
}

export async function healthProbe(env: Bindings): Promise<HealthReport> {
  const [db, kv, r2] = await Promise.all([checkDb(env), checkKv(env), checkR2(env)])
  const overall: HealthReport['overall'] = db.ok && kv.ok && r2.ok ? 'ok' : 'degraded'
  return { checks: { db, kv, r2 }, overall, ts: new Date().toISOString() }
}
