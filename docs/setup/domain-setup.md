# Custom Domain Setup

## Option A — Cloudflare Pages custom domain (recommended)

1. Buy/transfer domain to Cloudflare (or add existing domain)
2. CF Dashboard → Pages → your project → Custom domains
3. Click "Set up a custom domain"
4. Enter your domain → Cloudflare auto-configures DNS
5. HTTPS is automatic

## Option B — External domain pointing to CF Pages

1. In your DNS provider, add CNAME:
   - Name: `@` or `www`
   - Value: `your-project.pages.dev`
2. Enable proxy if using Cloudflare DNS

## Update robots.txt after domain setup
Replace `YOURDOMAIN.com` in `public/robots.txt` with your actual domain.

## Update Stripe webhook
If you change domains, update the webhook endpoint URL in Stripe Dashboard.
