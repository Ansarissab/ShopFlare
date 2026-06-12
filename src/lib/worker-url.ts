// Single source of truth for resolving the CF Worker origin from env.
//
// Shared by BOTH the client API layer (lib/api.ts) and the Next.js CSP config
// (next.config.ts). They MUST agree: the CSP `connect-src`/`img-src` allow-list
// is built from this, and so is the actual fetch target. If they diverge, the
// browser CSP-blocks every API call in dev with no visible error other than a
// console CSP violation (page renders with no data).
//
// Pure + env-injected (no module-level `process.env`, no browser globals) so it
// is safe to import from next.config.ts, which evaluates in plain Node.

export type WorkerUrlEnv = {
  NEXT_PUBLIC_WORKER_URL?: string
  NODE_ENV?: string
  NEXT_PUBLIC_ALLOW_REMOTE_API?: string
}

// Dev/prod isolation guard: in development we REFUSE a non-localhost origin so
// `next dev` can never read or write production data — even if a production
// NEXT_PUBLIC_WORKER_URL is left in `.env.local`. Pass NEXT_PUBLIC_ALLOW_REMOTE_API=1
// to opt out (e.g. to point local dev at a staging worker on purpose).
//
// `onIgnoreRemote` lets callers surface a warning (lib/api.ts logs it) without
// baking a console dependency into this pure helper.
export function resolveWorkerUrl(
  env: WorkerUrlEnv,
  onIgnoreRemote?: (configured: string) => void,
): string {
  const configured = env.NEXT_PUBLIC_WORKER_URL?.replace(/\/$/, '') ?? ''
  const isDev = env.NODE_ENV === 'development'
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(configured)

  if (isDev && configured && !isLocal && env.NEXT_PUBLIC_ALLOW_REMOTE_API !== '1') {
    onIgnoreRemote?.(configured)
    return 'http://localhost:8787'
  }
  if (configured) return configured
  return isDev ? 'http://localhost:8787' : ''
}
