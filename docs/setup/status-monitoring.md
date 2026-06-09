# Status Monitoring — Better Stack Setup

ShopFlare exposes a machine health endpoint (`GET /healthz`) and an in-app live
status page (`/status`). External uptime history and alerting are handled by
**Better Stack** (free tier) — no code changes needed.

> **Why Better Stack?** UptimeRobot's free plan banned commercial use (Dec 2024).
> Better Stack free gives 3-minute HTTP checks, a hosted custom-domain status page,
> and email alert contacts at no cost.

---

## 1. Prerequisites

- API worker deployed to Cloudflare (`pnpm worker:deploy`). Note your worker URL:
  `https://<name>.<subdomain>.workers.dev`
- A free [Better Stack](https://betterstack.com/) account.

---

## 2. Create the Monitor

1. Log in → **Uptime** → **Monitors** → **New monitor**
2. Set **Monitor type**: HTTP
3. **URL**: `https://<api-worker-host>/healthz`
   - This is the `shopflare-worker` host, **not** the frontend worker.
4. **Check frequency**: 3 minutes (free-tier minimum)
5. **Expected status code**: `200`
   - Treat `503` (any binding degraded) and timeouts as **Down**.
6. **Name**: `ShopFlare API` (or your store name)
7. Save → monitor starts polling immediately.

> `/healthz` is public, returns no PII, and performs only three cheap DB/KV/R2
> ops per call — it won't exhaust your free-plan op limits at 3-minute intervals.

---

## 3. Create the Hosted Status Page

Better Stack hosts an uptime-history page (incidents, SLA) separate from the
in-app `/status` live snapshot.

1. **Status Pages** → **New status page**
2. **Domain**: `status.<your-domain>` (Better Stack gives a free `*.betteruptime.com`
   subdomain if you don't have a custom domain yet)
3. **Resources**: add the monitor you created in step 2 as a single resource named
   `Store backend`
4. **CNAME** (custom domain): follow Better Stack's DNS instructions to point
   `status.<your-domain>` to their servers.
5. Publish the page.

---

## 4. Add Alert Contacts

1. **Alerts** → **Alert contacts** → **New contact**
2. Add the merchant email at minimum.
3. On the monitor created in step 2, link this contact under **Alert contacts**.

Better Stack will email (and optionally call / Slack / PagerDuty) when the
monitor transitions Down → Up or Up → Down.

---

## 5. What each layer covers

| Layer | URL | Purpose |
|---|---|---|
| Machine endpoint | `GET /healthz` | Live D1/KV/R2 probe (200 ok / 503 degraded) |
| In-app status page | `/status` (frontend) | Customer-facing live snapshot |
| Better Stack monitor | polls `/healthz` | External check + alerting |
| Better Stack status page | `status.<domain>` | Public uptime history + incidents |

The in-app `/status` shows the **current** state; Better Stack owns **history**,
incidents, and SLA reports.

---

## 6. No secrets involved

`/healthz` exposes only booleans, latency numbers, a coarse error label
(`timeout` / `not_found` / `unreachable`), and an ISO timestamp. No env values,
no row data, no R2 object contents.
