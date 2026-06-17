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
export function serverWorkerUrl(): string {
  return resolveWorkerUrl(
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
}
