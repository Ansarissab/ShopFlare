# 10. App-level admin auth (password + HMAC token), not Cloudflare Access

Date: 2026-06-07
Status: Accepted (supersedes the CF Access admin-auth approach in earlier docs)

## Context

Admin was meant to be protected by Cloudflare Access (edge) plus in-worker JWT
re-verification. But on `*.workers.dev`:

- A Zero Trust **Self-hosted** Access application can only target hostnames that are
  **active zones in your account**. `*.workers.dev` is not your zone, so the Access
  app never enforces — requests reach the worker directly.
- The only Access option for `workers.dev` is the per-worker "Enable Access" toggle,
  which gates the **whole** worker — that would lock the public storefront, since the
  store and admin share one frontend worker.
- Path-scoped Access (`/admin*` only) therefore requires a **custom domain**. The
  project's constraint is $0 with no domain.

Cloudflare Access / Zero Trust is consequently **not used** (and needs no card).

## Decision

Single shared admin password with a stateless signed-token session:

- `POST /api/admin/login`: Turnstile + per-IP rate limit (5 / 5 min) + constant-time,
  length-blind password check against `ADMIN_PASSWORD` → returns an HMAC-SHA256 token
  (`{exp}`, 24-hour TTL) signed with `ADMIN_SESSION_SECRET` (`worker/lib/admin-session.ts`).
- `requireAdmin` (`worker/lib/access.ts`) verifies the `Authorization: Bearer` token on
  every other `/api/admin/*` request; fails closed (503 without secret, 401 otherwise).
- Frontend stores the token in `localStorage` and sends it as a Bearer header — a cookie
  can't be shared across the separate frontend/API `workers.dev` hosts (public-suffix
  domain). `AdminShell` (client) redirects to `/admin/login` when no token is present.
- **No account creation**: one password, rotated via `wrangler secret put ADMIN_PASSWORD`
  (no redeploy). Rotating `ADMIN_SESSION_SECRET` revokes all tokens.

## Consequences

- Security boundary is the API worker: the admin UI is a static shell with no protected
  data, so a public HTML load reveals nothing without a valid token.
- Residual risk: token in `localStorage` (XSS) — mitigated by the strict CSP. A custom
  domain would allow an httpOnly cookie + path-scoped CF Access (see ADR 0009 / domain
  setup) — the recommended upgrade if/when a domain is added.
- Removed the CF Access JWT verifier (`access-core`), the Next proxy/middleware, and the
  `CF_ACCESS_*` env vars.
