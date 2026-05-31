# Resend Setup

## 1. Create account
https://resend.com — free tier: 3,000 emails/month

## 2. Add your domain
Resend Dashboard → Domains → Add Domain
Follow DNS instructions (add 3 DNS records in Cloudflare).

## 3. Get API key
Resend Dashboard → API Keys → Create API Key
Full access scope.

## 4. Add to CF Worker
```bash
npx wrangler secret put RESEND_API_KEY
# paste re_... when prompted
```

## 5. Configure merchant BCC
In Admin Dashboard → Settings → Email, enter merchant email.
All order confirmation emails will BCC this address.

## Free tier math
1 email per confirmed order.
Free 3,000/month = 3,000 orders/month at no cost.
Paid plan: $20/month for 50,000 emails.
