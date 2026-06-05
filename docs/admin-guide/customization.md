# Customizing Your Store

All changes take effect immediately — no redeployment needed.

## Store identity

Admin → Settings → Store
- Store name (appears in browser title, emails)
- Tagline (appears under logo)
- Logo (upload PNG/SVG, stored in R2)
- Contact email
- WhatsApp number (for order channel + merchant notifications)
- Social links (Instagram, Facebook, TikTok)

## Brand colors

Admin → Settings → Theme
- Primary color (buttons, CTAs)
- Accent color (highlights, badges)
- Changes apply site-wide instantly via CSS variables

## Currency

Admin → Settings → Store → Currency
- Select from: PKR, USD, GBP, EUR, AED, BDT, SAR
- All existing prices will display in new currency
- Stripe prices are recreated in new currency on save

## Products per page

Admin → Settings → Payments & Shipping → Products per page

Controls how many products load in the first batch on the home page and category pages, and how many more load each time the customer scrolls to the bottom (infinite scroll).

- Minimum: 6 · Maximum: 96 · Step: 6 · Default: 24
- Smaller values reduce initial load time; larger values suit stores with many products where customers prefer to see everything at once.
- Change takes effect immediately — no redeploy needed.

## Policies

Admin → Settings → Policies
Edit markdown content for:
- Shipping Policy
- Return Policy
- Privacy Policy
- Terms of Service

Shown on dedicated pages + product page summary cards.
