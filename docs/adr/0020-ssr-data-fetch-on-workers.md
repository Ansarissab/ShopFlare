# 0020 — Server-side data fetching on OpenNext / Cloudflare Workers

Status: Accepted (2026-06-17)

## Context

The frontend (`shopflare-web`, Next.js via OpenNext) renders pages by fetching the API
worker (`shopflare-worker`) server-side through `src/lib/server/fetchFromWorker.ts`. After
the first production deploy, **every data page rendered its not-found state** (products,
categories, blog, policy, landing) even though the API and D1 were healthy and the browser's
own client-side calls worked. Two distinct Cloudflare-edge behaviors caused it; both only bit
the *deployed* worker (local `dev`/`preview` on workerd does not enforce them), which made it
look like a stale deploy or a caching issue for a long time. The error was also **swallowed**
(`catch { return null }` → `notFound()`), so there was nothing in the logs.

### Cause 1 — the Next Data Cache has no backing store on workerd
`fetchFromWorker` used `fetch(url, { next: { revalidate } })`. That routes through Next's
Data Cache, which on OpenNext requires a configured `incrementalCache`. `open-next.config.ts`
ships the bare `defineCloudflareConfig()` (no KV/R2 cache binding), so the cached fetch failed
on the deployed worker.

### Cause 2 — same-zone Worker → Worker fetch needs a compatibility flag
Both workers live on the same `*.workers.dev` zone. On the Cloudflare edge, a Worker fetching
another Worker on the same zone fails with **error 1042** unless the
`global_fetch_strictly_public` compatibility flag is set. (Locally the fetch leaves to the
public internet and comes back, so it works — masking the problem.)

## Decision

1. **Fetch directly, no Data Cache.** `fetchFromWorker` uses `fetch(url, { cache: 'no-store' })`.
   Store pages are dynamic anyway. The `revalidate` option is retained but is a no-op until an
   incremental cache exists (see Consequences).
2. **Never swallow silently.** The `catch` logs `[fetchFromWorker] <path> failed: …` before
   returning `null`, so a failing server fetch is visible in `wrangler tail` in seconds.
3. **Set `global_fetch_strictly_public`** in `wrangler.frontend.jsonc` `compatibility_flags`.
   This forces `fetch()` to route over the public internet, so the frontend reaches the API
   worker normally. Harmless if the API ever moves to a custom domain.
4. **Loud config guard.** `serverWorkerUrl()` logs a one-shot error if `NEXT_PUBLIC_WORKER_URL`
   is empty in a non-dev build; `scripts/preflight-prod.mjs` blocks deploys with a missing/
   localhost `.env.production` or a `.env.local` that re-introduces `NEXT_PUBLIC_*` overrides.

## Consequences

- All storefront pages are fully dynamic (`no-store`). Correct and safe for now; the cost is
  no edge caching of data fetches.
- **Future ISR / data caching:** wire an `incrementalCache` (R2 or KV) in
  `open-next.config.ts`, then restore the `next: { revalidate }` path in `fetchFromWorker`
  (the option and a code comment are already in place for this).
- **Verify deploys on the real edge, not just preview.** Local `opennextjs-cloudflare preview`
  does NOT reproduce same-zone fetch (1042) or the missing Data Cache the same way. Confirm a
  data page renders on the deployed `*.workers.dev` host after deploy.
- Reference: <https://developers.cloudflare.com/workers/observability/errors/> (error 1042).
