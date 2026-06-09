# Plan 25 — Status / Uptime (machine `/healthz` + public Status Page + external monitor)

> **For the implementer (Sonnet):** Execute end-to-end. Follow CLAUDE.md DRY rules.
> All UI strings live in [`src/lib/i18n/en.ts`](../../../src/lib/i18n/en.ts) — never
> hardcode in JSX. No raw `fetch()` in app code (use [`src/lib/api.ts`](../../../src/lib/api.ts)).
> Never edit build/output folders (`.next/`, `.open-next/`). Never read secrets. Do **not**
> `git push` or open a PR. Small focused commits per §6.

This is roadmap item #2 (status/uptime page). It depends on **Phase 17** for the
`buildPageMetadata` helper and the server-component conversion pattern; reuse both for the
`/status` page rather than re-inventing them.

---

## 1. Goal

Give the merchant (and their customers) a way to see whether the store's backend is up, and
give the merchant external alerting + uptime history — at **$0**.

Two layers:
- **Machine endpoint** `GET /healthz` in the API worker (`shopflare-worker`) that probes
  D1, KV, and R2 **independently** and returns JSON with HTTP `200` (all ok) or `503` (any
  fail). This is what an external monitor polls.
- **Public Status Page** `/status` in the frontend app (`shopflare-web`), SSR, that renders
  the current per-service health from `/healthz` in human-readable form.

External uptime history + alerting is owned by **Better Stack (free tier)**, not the app
(§8 Non-goals). The app only exposes the live signal.

### Research-grounded decisions (June 2026) — rationale

- **External monitor: Better Stack FREE.** 3-minute HTTP checks, a hosted custom-domain
  status page, and alert contacts on the free plan. Chosen over **UptimeRobot**, whose free
  plan banned commercial use as of Dec 2024 — a merchant store is a commercial use, so its
  free tier is off the table.
- **Not Cloudflare Health Checks.** That is a paid Load-Balancing feature, so it breaks the
  $0 rule.
- **Not Workers observability for the public page.** It gives free internal metrics but no
  public status page, so it can't satisfy the customer-facing requirement.
- **Probe D1 / KV / R2 independently.** They are separate failure domains; one can be down
  while the others are healthy. A single combined probe would hide which subsystem failed.

---

## 2. Current state (refs)

- The **only** health signal today is
  [`worker/index.ts:35`](../../../worker/index.ts) — `app.get('/api/ping', (c) => c.json({ ok: true }))`.
  It does **not** touch D1/KV/R2, so it cannot detect a degraded binding.
- Integration coverage for it:
  [`worker/test/api.integration.test.ts:54-59`](../../../worker/test/api.integration.test.ts)
  (`'health + public config'` describe block).
- Public config (safe keys only): [`worker/index.ts:55-62`](../../../worker/index.ts).
- CDN route serving R2 objects: [`worker/index.ts:41-53`](../../../worker/index.ts)
  (`/cdn/*` → `c.env.R2.get(key)`). Seeded product images give us a **known R2 object** for
  the R2 `head()` probe.
- Env bindings (single source of truth): [`worker/types.ts`](../../../worker/types.ts) —
  `DB` (`D1Database`), `KV` (`KVNamespace`), `R2` (`R2Bucket`). Never rename these.
- Integration suite runs the real worker in the miniflare/workerd pool with ephemeral
  D1/KV/R2: [`vitest.integration.config.ts`](../../../vitest.integration.config.ts);
  `ENVIRONMENT=development` (Turnstile/auth bypass) is already set there.
- Store routes live under `src/app/(store)/**` (e.g.
  [`src/app/(store)/track/page.tsx`](../../../src/app/(store)/track/page.tsx)); the layout
  already exports `metadata` ([`src/app/(store)/layout.tsx:11`](../../../src/app/(store)/layout.tsx)).
- `worker/lib/health.ts` does **not** exist yet (the roadmap reserved the name; this phase
  implements it). Sibling helpers for reference:
  [`worker/lib/http.ts`](../../../worker/lib/http.ts),
  [`worker/lib/version.ts`](../../../worker/lib/version.ts).

---

## 3. Deliverables

### 3.1 (a) `worker/lib/health.ts` — `healthProbe(env)`

Shared probe logic (DRY: one function, consumed by every health route). Signature:

```ts
type CheckResult = { ok: boolean; latencyMs: number; error?: string }
type HealthReport = {
  checks: { db: CheckResult; kv: CheckResult; r2: CheckResult }
  overall: 'ok' | 'degraded'
  ts: string // ISO timestamp
}
export async function healthProbe(env: Bindings): Promise<HealthReport>
```

Rules:
- Each of `db`/`kv`/`r2` is probed **independently** with its own `try/catch` and a small
  timeout (see §4). A failure in one check must NOT short-circuit the others.
- **Never throws.** A thrown probe becomes `{ ok: false, latencyMs, error }` where `error`
  is a short sanitised label (§5), never the raw exception message.
- `overall` = `'ok'` only if **all three** `ok`; otherwise `'degraded'`.
- Import `Bindings` from [`worker/types.ts`](../../../worker/types.ts); do not redeclare it.
- Wrap each check in a `withTimeout(p, ms)` helper (local to this file, or extend
  [`worker/lib/http.ts`](../../../worker/lib/http.ts) if a generic timeout already fits).

### 3.2 (b) Worker routes — `GET /healthz` (+ keep `/api/ping`)

In [`worker/index.ts`](../../../worker/index.ts), mount **above** the `/api/*` route stubs:

- `GET /healthz` → `const report = await healthProbe(c.env)` → return `c.json(report, report.overall === 'ok' ? 200 : 503)`.
- Optional lightweight `GET /status` JSON alias that returns the same body (the frontend page
  lives at the frontend worker's `/status`, so a worker-side `/status` JSON alias is a
  convenience only — keep it if cheap, otherwise skip; do not let the two `/status` paths
  confuse the monitor target, which must be `/healthz`).
- **Keep** `/api/ping` unchanged (its integration test and any existing callers stay green).

Bindings are `DB`/`KV`/`R2` (never rename). Routes are covered behaviorally by the
integration suite, not the unit coverage gate (per CLAUDE.md), so the probe's **pure** logic
that can be unit-tested (e.g. the `overall` rollup) should live in a form vitest-node can
exercise; the binding calls are exercised by integration.

### 3.3 (c) Frontend public `/status` page (SSR)

New route `src/app/(store)/status/page.tsx`:
- **Async Server Component** (same pattern Phase 17 establishes for product/category/policy).
- Fetch `/healthz` **server-side** via the existing data layer
  ([`src/lib/api.ts`](../../../src/lib/api.ts) `apiGet`), with `cache: 'no-store'` / no
  revalidate so the page always reflects live state. Tolerate a non-200 (a 503 body is still
  valid JSON to render — read it as the degraded report rather than throwing).
- Render per-service rows (Database / Storage cache / Media storage) each showing an
  up/down indicator, plus an overall banner and a "last checked" timestamp (`report.ts`).
- Use `buildPageMetadata` from `src/lib/seo/metadata.ts` (Phase 17) for the page `<title>` /
  description; if Phase 17 has not landed yet, fall back to a local `export const metadata`
  consistent with [`src/app/(store)/layout.tsx`](../../../src/app/(store)/layout.tsx).
- All visible text from `en.ts` (§3.5). Colors via CSS vars / existing status styles only —
  no hardcoded hex. Reuse any existing badge/indicator component before adding one.

### 3.4 (d) Better Stack (free) setup — documented, not coded

New doc `docs/setup/status-monitoring.md` with concrete steps:
1. Create a free Better Stack account; create a **Monitor**:
   - URL: `https://<api-worker-host>/healthz` (the `shopflare-worker` host).
   - Check frequency: 3 minutes (free-tier minimum).
   - Expected status: `200`; treat `503` (and timeouts) as **down**.
2. Create a **hosted Status Page** on `status.<domain>` (CNAME per Better Stack's docs),
   listing the monitor as a single "Store backend" resource. This is the public uptime
   history page (the in-app `/status` is the live snapshot; Better Stack owns history).
3. Add **alert contacts** (email at minimum) on the monitor.
4. Note: no secrets involved — `/healthz` is public and exposes no PII (§5).

### 3.5 (e) `en.ts` strings

Add a `status` group to [`src/lib/i18n/en.ts`](../../../src/lib/i18n/en.ts), e.g.
`status.title`, `status.allOperational`, `status.degraded`, `status.lastChecked`,
`status.service.database`, `status.service.storage`, `status.service.media`,
`status.up`, `status.down`, `status.checkFailed`. Service-status **labels** that are also
machine values (`ok`/`degraded`) stay as constants if reused — consider
[`src/lib/constants`](../../../src/lib/constants) for the canonical service keys so the page
and any future consumer agree on names.

---

## 4. Probe design details

Each check does the **minimum** work to prove the binding round-trips, to stay inside the
Workers free-plan op limits (every probe runs every 3 min × however many monitors):

- **D1 (`db`):** `await env.DB.prepare('SELECT 1').first()`. Read-only, no table dependency,
  one cheap query. A synthetic write/read is **optional** and deliberately omitted by default
  (a write every 3 min burns D1 write quota for no extra signal — `SELECT 1` already proves
  the connection + query path). Document the trade-off in the file header.
- **KV (`kv`):** write a tiny sentinel and read it back —
  `await env.KV.put('__health', ts, { expirationTtl: 60 })` then `env.KV.get('__health')`.
  TTL keeps it self-cleaning; key is namespaced with `__` to avoid colliding with app keys.
  (If KV write quota is a concern, a read-only `env.KV.get('__health')` after a one-time seed
  is acceptable — pick the read-write variant for a true write-path signal and note it.)
- **R2 (`r2`):** `await env.R2.head(key)` on a **known** object key. Prefer a dedicated
  sentinel key (e.g. `__health`) seeded once; otherwise `head()` a seeded product image used
  by [`/cdn/*`](../../../worker/index.ts). `head()` returns metadata only (no body download),
  so it's the cheapest R2 existence proof. A `null` result (object missing) = check fails.
- **Timeouts:** wrap each check with a short timeout (~1500 ms suggested) so one hung binding
  can't stall the whole response; on timeout the check is `{ ok: false, error: 'timeout' }`.
- **Independence:** run the three with `Promise.allSettled` (or three awaited try/catch
  blocks) so all three always report, even when one rejects.
- **No heavy/costly probes:** no full-table scans, no large R2 GETs, no batch KV ops.

---

## 5. Security

- `/healthz` exposes **no secrets and no PII** — only booleans, latencies, a coarse error
  label, and a timestamp. No env values, no row data, no R2 object contents.
- **Do not leak internal errors verbatim.** Map any caught exception to a short sanitised
  label (`'timeout'`, `'unreachable'`, `'not_found'`) — never `error.message` / stack.
- Keep the endpoint **cheap** (§4) so it isn't a DoS amplifier; the work per request is three
  tiny ops. Rate-limiting is optional — if added, reuse
  [`worker/lib/ratelimit.ts`](../../../worker/lib/ratelimit.ts) rather than a new mechanism,
  and keep limits generous enough for a 3-min monitor + occasional human loads.
- No auth on `/healthz` or `/status` (they are intentionally public — the monitor and
  customers both need them).
- CORS: `/healthz` is read by the frontend worker server-side (no browser CORS) and by
  Better Stack (server-to-server), so it does not need to be added to the browser CORS allow
  rules in [`worker/index.ts:7-32`](../../../worker/index.ts).

---

## 6. Rollout (small commits, conventional)

1. `feat(worker): health.ts healthProbe — independent D1/KV/R2 probes, never throws`
2. `feat(worker): GET /healthz (200/503 JSON) + optional /status alias; keep /api/ping`
3. `test(integration): /healthz happy path + forced single-binding failure → 503`
4. `feat(store): /status SSR page rendering per-service health from /healthz`
5. `feat(i18n): status page strings in en.ts (+ service-key constants)`
6. `docs(setup): status-monitoring.md — Better Stack monitor + hosted status page steps`
7. `docs: overview.md + README + CONTEXT verify; mark phase-25 done`

---

## 7. Acceptance

- `GET /healthz` returns **200** with `overall: 'ok'` when D1/KV/R2 all succeed.
- `GET /healthz` returns **503** with `overall: 'degraded'` and the failing check `ok: false`
  when one binding is forced to fail (test stubs a rejecting binding — the other two stay
  `ok`).
- `healthProbe` **never throws** — a forced failure surfaces as a check result, not a 500.
- `/api/ping` still returns `{ ok: true }` (existing test green).
- `/status` SSR page renders: all-operational state, a degraded state (per-service down), and
  a "last checked" timestamp; all text from `en.ts`; no console errors.
- Integration tests added for the `/healthz` happy path **and** a simulated single-binding
  failure (alongside [`worker/test/api.integration.test.ts`](../../../worker/test/api.integration.test.ts)).
- Better Stack steps documented in `docs/setup/status-monitoring.md` (monitor on `/healthz`,
  hosted status page on `status.<domain>`, alert contacts).
- `pnpm verify` (alias `pnpm run ci`) green: typecheck → lint → unit+coverage (≥95% on the
  unit project) → integration → build.

---

## 8. Non-goals

- **No historical uptime storage in the app** — Better Stack owns history/incidents/SLA.
- **No paid Cloudflare Health Checks** (Load-Balancing) — breaks $0.
- **No alerting infrastructure in the app** — alerts live in Better Stack.
- **No multi-region probing** — a single Workers probe is enough for v1.
- **No synthetic D1 write probe by default** (§4 rationale) — `SELECT 1` is sufficient.
- **No status incident editor / manual "maintenance mode"** in the admin (future phase).

---

## 9. Docs to update

- [`CONTEXT.md`](../../../CONTEXT.md) — **verify** the `## Health Check` (line 117) and
  `## Status Page` (line 120) glossary terms already exist and match the shipped behavior
  (200 healthy / 503 degraded; in-app live snapshot vs external history). Adjust wording only
  if implementation diverged.
- **New** `docs/setup/status-monitoring.md` — Better Stack monitor + hosted status page +
  alert-contact steps (§3.4). Cross-link from
  [`docs/setup/cloudflare-guide.md`](../../../docs/setup/cloudflare-guide.md).
- [`docs/architecture/overview.md`](../../../docs/architecture/overview.md) — add the
  `/healthz` endpoint, `worker/lib/health.ts`, and the `/status` page to the component map.
- [`README.md`](../../../README.md) — one line on the status/uptime story under features.
- When 100% done + audited: `git mv docs/plans/proposed/phase-25-status-uptime.md docs/plans/done/`
  and commit as the final step.

---

## 10. Self-audit checklist

- [ ] `healthProbe(env)` probes D1/KV/R2 **independently** (per-check try/catch) and **never
      throws** — a forced failure returns a check result, not an exception.
- [ ] `GET /healthz` returns **200** when all checks pass and **503** when any check fails;
      JSON shape is `{ checks: { db, kv, r2 }, overall, ts }`.
- [ ] `/api/ping` left unchanged and its existing test still passes.
- [ ] `/status` SSR page renders per-service up/down + last-checked, all states.
- [ ] All UI strings in [`src/lib/i18n/en.ts`](../../../src/lib/i18n/en.ts); service keys in
      [`src/lib/constants`](../../../src/lib/constants); no hardcoded hex/text.
- [ ] Integration tests cover the `/healthz` happy path **and** a forced single-binding
      failure (→ 503, other checks still `ok`).
- [ ] Better Stack setup fully documented in `docs/setup/status-monitoring.md`
      (monitor on `/healthz`, hosted status page, alert contacts).
- [ ] No secrets / PII exposed by `/healthz` or `/status`; internal errors sanitised, not
      leaked verbatim.
- [ ] No edits to build/output folders (`.next/`, `.open-next/`); bindings still `DB`/`KV`/`R2`.
- [ ] `pnpm verify` green (typecheck, lint, unit+coverage ≥95%, integration, build).
- [ ] Plan re-read end-to-end before marking done; `git mv` to `docs/plans/done/`.
