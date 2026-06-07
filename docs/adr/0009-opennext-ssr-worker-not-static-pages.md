# 9. Frontend ships as an OpenNext SSR Worker, not static Cloudflare Pages

Date: 2026-06-07
Status: Accepted (supersedes the Pages/static assumption in ADR 0001)

## Context

The original plan (ADR 0001) assumed the Next.js frontend would be a static export
hosted on Cloudflare Pages. By go-live the app had grown a server proxy/middleware
(admin guard) and dynamic routes (`product/[slug]`, `category/[slug]`,
`track/[orderId]`, …), plus `next.config` `headers()`. None of those survive a static
export — `output: 'export'` ignores `headers()` and cannot run middleware. So a
static `out/` deploy was no longer possible, and `wrangler pages deploy out` had
nothing to deploy.

## Decision

Deploy the frontend as its own Cloudflare **Worker** using `@opennextjs/cloudflare`:

- `open-next.config.ts` (default adapter config) + `wrangler.frontend.jsonc` (worker
  `shopflare-web`, `main = .open-next/worker.js`, `ASSETS` binding).
- Scripts `pnpm web:preview` / `pnpm web:deploy` (`-c wrangler.frontend.jsonc`), kept
  separate from the API worker's `wrangler.toml` so the two deploy independently.
- The API worker (`shopflare-worker`) is unchanged; the frontend talks to it over
  HTTP via `NEXT_PUBLIC_WORKER_URL`.

## Consequences

- Full SSR/RSC + middleware + dynamic routes work, unchanged.
- Static, non-dynamic pages still prerender to Workers Static Assets (free, unmetered);
  dynamic routes and the proxy invoke the worker (counts toward the 100K/day free pool).
- Two workers share the account-wide 100K req/day free limit. Still $0 (over-limit =
  429, never billed). See `docs/architecture/cost-breakdown-normal.md`.
- `next.config.ts` calls `initOpenNextCloudflareForDev()` so `next dev` sees bindings.
- Server bundle is ~1.7 MiB gzip (framework floor for OpenNext) — under the 3 MiB free
  worker limit; it runs on the edge and is not downloaded by visitors.
