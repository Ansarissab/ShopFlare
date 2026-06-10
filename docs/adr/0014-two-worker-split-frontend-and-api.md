# 14. Two-worker split: OpenNext frontend + Hono API, not one Next.js worker

Date: 2026-06-09
Status: Accepted (formalises a split that pre-dates ADR 0009)

## Context

The app is a single Next.js codebase, yet it deploys as **two** Cloudflare Workers:
the OpenNext SSR frontend (`shopflare-web`, `wrangler.frontend.jsonc`) and the Hono
API (`shopflare-worker`, `wrangler.toml`). A single worker is technically possible —
Next.js Route Handlers (`app/api/*`) can run inside the OpenNext worker and bind D1/KV/R2
directly — so the split is a deliberate choice, not a requirement.

It is also partly historical: ADR 0001 assumed a static Pages frontend + a separate API
worker. When the frontend moved to its own OpenNext worker (ADR 0009), the API worker was
left "unchanged" and the split was never re-litigated. This ADR records the reasoning so
it does not have to be re-derived.

## Decision

Keep two workers, one per runtime concern:

- **Frontend worker** — Next.js SSR/RSC via `@opennextjs/cloudflare`. OpenNext repackages
  Next's server output to run on workerd; the server bundle is ~1.7 MiB gzip (framework
  floor). Holds only an `ASSETS` binding — no DB, no secrets. Renders UI and fetches data
  from the API over HTTP (`NEXT_PUBLIC_WORKER_URL`).
- **API worker** — Hono. Tiny router, near-zero cold start. Owns all `/api/*` routes,
  Stripe webhooks, cron, and the **only** bindings to D1/KV/R2 plus all secrets.

Rationale:

1. **Runtime fit.** Webhooks and API calls are high-frequency and latency-sensitive.
   Routing them through the 1.7 MiB OpenNext bundle pays SSR-framework overhead per
   request. Hono stays lean and cold-starts fast.
2. **Independent deploy lifecycles.** `pnpm worker:deploy` and `pnpm web:deploy` ship
   separately — an API change never rebuilds/redeploys the SSR frontend, and vice versa.
3. **Security boundary.** D1/KV/R2 and secrets bind to the API worker only; the SSR layer
   never touches the DB. Smaller attack surface (see ADR 0010 — the admin security
   boundary is the API worker).
4. **No cost penalty.** Both workers share the account-wide 100K req/day free pool
   (ADR 0009), so splitting costs no extra request budget. Still $0.

## Consequences

- **Cross-host cookie friction.** The two `*.workers.dev` hosts are separate public-suffix
  domains, so a cookie can't be shared. The admin session token therefore travels as an
  `Authorization: Bearer` header, not a cookie (ADR 0010). This workaround exists *only*
  because of the split.
- **CORS layer required** between the two hosts (`worker/index.ts` — single known origin,
  never `*`, fails closed in production).
- Two wrangler configs, two deploy commands, two URLs to operate.
- **Upgrade path:** a custom domain could front both workers under one host with path
  routing — which would let the admin token return to an httpOnly cookie and drop the
  Bearer workaround. Fully collapsing into Next Route Handlers is also possible but trades
  away the lean Hono API and the independent deploy cadence; not planned.
