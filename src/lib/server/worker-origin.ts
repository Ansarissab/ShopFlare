import { resolveWorkerUrl } from '@/lib/worker-url'

let warnedRemote = false

/**
 * Server-side CF Worker origin, resolved through the shared dev/prod guard
 * (lib/worker-url). Use anywhere server code targets the worker — server
 * components, route handlers, sitemap, manifests, RSS. Dev → http://localhost:8787
 * (unless NEXT_PUBLIC_ALLOW_REMOTE_API=1), prod → the configured worker. Mirrors
 * the client (lib/api.ts) and the CSP (next.config.ts) so they never diverge and
 * `next dev` can never silently read production data. Trailing slash already
 * stripped by resolveWorkerUrl. Read each env var as a static member access.
 */
let warnedEmptyProd = false

export function serverWorkerUrl(): string {
  const url = resolveWorkerUrl(
    {
      NEXT_PUBLIC_WORKER_URL: process.env.NEXT_PUBLIC_WORKER_URL,
      NODE_ENV: process.env.NODE_ENV,
      NEXT_PUBLIC_ALLOW_REMOTE_API: process.env.NEXT_PUBLIC_ALLOW_REMOTE_API,
    },
    (configured) => {
      if (warnedRemote) return
      warnedRemote = true
      console.warn(
        `[worker-origin] Ignoring non-local NEXT_PUBLIC_WORKER_URL (${configured}) in development ` +
          `to keep dev off production. Using http://localhost:8787; set NEXT_PUBLIC_ALLOW_REMOTE_API=1 to override.`,
      )
    },
  )
  // Loud, single-shot signal for the silent-404 failure mode: in a deployed
  // (non-dev) build with no NEXT_PUBLIC_WORKER_URL, resolveWorkerUrl returns ''
  // and every server fetch falls back to a relative `/api/*` on the Next origin
  // → 404 → all data pages render their not-found state. Surface it in the worker
  // logs so this is diagnosable instead of mysterious. (Deploys are also blocked
  // upfront by scripts/preflight-prod.mjs.)
  if (!url && process.env.NODE_ENV !== 'development' && !warnedEmptyProd) {
    warnedEmptyProd = true
    console.error(
      '[worker-origin] NEXT_PUBLIC_WORKER_URL is empty in a production build — server-side API ' +
        'fetches will hit a relative /api path and 404. Set it in .env.production.',
    )
  }
  return url
}
