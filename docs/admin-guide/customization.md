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

## Landing page

Admin → Landing Page

Toggle `Enable landing page`. When ON, `/` becomes a storytelling marketing page and the product catalog moves to `/shop`. When OFF, `/` is the product grid (default).

The landing page is built from five ordered sections — each toggleable independently:

| Section | What it shows |
| --- | --- |
| **Hero** | Headline, subtext, CTA button, optional image. Layout selectable (image-left, full-bleed, centered, split). |
| **Story** | Heading + rich-text brand story + optional image. |
| **Featured Products** | Curated product strip. Select up to 20 products and drag to reorder. |
| **Reviews** | Automatically pulls up to 20 approved store-wide reviews. |
| **CTA Band** | Heading, subtext, and a call-to-action link button. |

All section text, images (uploaded to R2), and CTA links are editable from the dashboard — no redeploy.

## Style presets

Admin → Settings → Appearance → Style Presets

Six named looks, each bundling brand colors, font, corner radius, spacing density, and hero layout in one click:

| Preset | Primary | Accent | Feel |
| --- | --- | --- | --- |
| Midnight | Near-black | Oxidized copper | Minimal, dark |
| Emerald | Deep green | Mint | Fresh, nature |
| Sunset | Deep orange | Warm orange | Warm, editorial |
| Ocean | Deep blue | Sky | Clean, airy |
| Elegant | Dark navy | Cream | Luxury serif |
| Playful | Violet | Amber | Bold, rounded |

Clicking a preset fills the individual color, font, radius, density, and hero-layout fields. You can still override any field manually after applying a preset.

**Density** controls spacing and padding scale (compact / comfortable / spacious).
**Hero layout** is the default layout for the landing page hero section (image-left / full-bleed / centered / split).

## Policies

Admin → Settings → Policies
Edit markdown content for:
- Shipping Policy
- Return Policy
- Privacy Policy
- Terms of Service

Shown on dedicated pages + product page summary cards.
