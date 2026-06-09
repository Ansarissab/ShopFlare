# GitHub → Cloudflare Deploy Pipeline

Automate deploys via GitHub Actions. **Disabled by default** — CLI deploy
(`pnpm worker:deploy` / `pnpm web:deploy`) remains the primary path.

## When to enable

- You want push-button deploys from GitHub without SSH/local wrangler
- CI-triggered staging deploys on a branch
- Team members who need to deploy but shouldn't have direct CF access

## How to enable

### 1. Create a Cloudflare API token

Cloudflare Dashboard → **My Profile → API Tokens → Create Token → Create Custom Token**

Required permissions (minimal scopes — do not grant broader access):

| Resource | Permission |
|---|---|
| Account Settings | Read |
| Workers Scripts | Edit |
| Workers KV Storage | Edit |
| Workers R2 Storage | Edit |
| D1 | Edit |

Set **Account Resources** → include your account. No Zone permissions needed.

### 2. Add GitHub secrets

Repository → **Settings → Secrets and variables → Actions → Secrets**:

| Secret | Required | Value |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | Yes | the token created above |
| `CLOUDFLARE_ACCOUNT_ID` | Yes | your CF account id (`npx wrangler whoami` or dashboard URL) |
| `WRANGLER_TOML_OVERRIDE` | Existing resources only | base64-encoded `wrangler.toml` with real D1/KV ids (see below) |

Worker runtime secrets (Stripe keys, RESEND_API_KEY, etc.) are **not** needed here —
they were set via `wrangler secret put` during `pnpm setup` and live in CF, not GitHub.

#### WRANGLER_TOML_OVERRIDE (existing setups only)

The committed `wrangler.toml` has no D1/KV ids so fresh forks auto-provision new
resources. For existing setups with real resources:

- **D1** re-links by `database_name = "shopflare-db0"` — safe without the override.
- **R2** re-links by `bucket_name = "shopflare-images0"` — safe without the override.
- **KV** has no name, only a binding (`KV`) — without an id, wrangler provisions a
  **new** namespace, disconnecting your existing KV data.

To preserve your existing KV (and D1/R2 for certainty): base64-encode your local
`wrangler.local.toml` (which has the real ids) and add it as a secret:

```bash
base64 -i wrangler.local.toml | pbcopy   # macOS — pastes into the secret field
```

The workflow decodes this secret over `wrangler.toml` before deploying.

### 3. Set the enable variable

Repository → **Settings → Secrets and variables → Actions → Variables → New**:

| Variable | Value |
|---|---|
| `ENABLE_GH_DEPLOY` | `true` |

Without this variable the workflow job is skipped even when dispatched.

### 4. Trigger a deploy

Repository → **Actions → Deploy to Cloudflare → Run workflow → Run workflow**

The workflow deploys the API worker first, then the frontend worker. It does not
run on push or pull request — manual dispatch only.

---

## What the workflow does

1. Installs pnpm dependencies (`--frozen-lockfile`)
2. `pnpm worker:deploy` — deploys `shopflare-worker` (Hono API, `wrangler.toml`)
3. `pnpm web:deploy` — OpenNext build + deploys `shopflare-web` (`wrangler.frontend.jsonc`)

Both steps run with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` from secrets.

---

## Notes

- The workflow file is [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml).
- **Do not add a `push:` trigger** unless you want every merge to `main` to deploy.
  Accidental production deploys are hard to roll back.
- To disable: set `ENABLE_GH_DEPLOY` to any value other than `true`, or delete the variable.
- Worker runtime secrets (ADMIN_PASSWORD, Stripe keys, etc.) travel via
  `wrangler secret put` — never mirror them as GitHub secrets unless you have a
  specific reason (e.g. a staging environment that needs its own values).
