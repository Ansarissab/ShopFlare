# Custom Domain Setup

A custom domain is **optional** — the free `*.workers.dev` hosts work out of the box.
Add one for a branded URL (and to unlock path-scoped Cloudflare Access for admin, which
`*.workers.dev` can't do — see ADR 0010).

## Step 1 — Add the domain to Cloudflare as a zone

1. CF Dashboard → add your domain (buy/transfer, or add an existing one).
2. Point the domain's nameservers at Cloudflare (Cloudflare shows them). The domain
   must be an **active zone** in your account.

## Step 2 — Map each Worker to a custom hostname

The site is two Workers, so give each a subdomain:

- Frontend (`shopflare-web`): Workers & Pages → `shopflare-web` → Settings →
  **Domains & Routes** → Add → e.g. `store.yourdomain.com`.
- API (`shopflare-worker`): same flow → e.g. `api.yourdomain.com`.

HTTPS is automatic.

## Step 3 — Update env + redeploy

| Where | Variable | New value |
| --- | --- | --- |
| `.env.local` (build-time) | `NEXT_PUBLIC_WORKER_URL` | `https://api.yourdomain.com` |
| `.env.local` (build-time) | `NEXT_PUBLIC_SITE_URL` | `https://store.yourdomain.com` |
| API worker secret | `FRONTEND_URL` | `https://store.yourdomain.com` |

```bash
npx wrangler secret put FRONTEND_URL   # store.yourdomain.com
pnpm worker:deploy                     # API picks up FRONTEND_URL (CORS + redirects)
pnpm web:deploy                        # rebuild bakes the new NEXT_PUBLIC_* values
```

## Step 4 — Update robots.txt + Stripe

- Replace `YOURDOMAIN.com` in `public/robots.txt` with your actual domain.
- Update the Stripe webhook endpoint URL to `https://api.yourdomain.com/api/stripe/webhook`.
