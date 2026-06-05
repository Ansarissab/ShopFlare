# Plan 12 — Helpful Tooltips (admin-first)

> **For the implementer (Sonnet):** Execute end-to-end. Follow CLAUDE.md DRY
> rules HARD here — this plan touches many files, so the win is **one reusable
> helper + one i18n namespace**, applied everywhere. Do NOT inline tooltip JSX
> per file. Do NOT hardcode tooltip text in components (goes in `lib/i18n/en.ts`).
> Commit in the small commits at the end. Do **not** `git push` or open a PR.

---

## 1. Goal

Add explanatory tooltips wherever a control, metric, or column is non-obvious —
**concentrated in the admin dashboard** (merchants are not developers; the
Dynamic-First rule means they edit lots of fields they may not understand).
Storefront gets a light touch only.

## 2. Current state (read first)

- Primitive exists: `src/components/ui/tooltip.tsx` (base-ui) — exports
  `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider`.
- **It is currently used nowhere.** The four `<Tooltip>` hits in
  `admin/page.tsx` + `admin/analytics/page.tsx` are **Recharts** chart tooltips,
  a different component. ⚠️ Name collision: in any file that imports Recharts,
  do NOT also import our `Tooltip` — import the **helper** (§3) instead.
- **No `TooltipProvider` is mounted.** base-ui tooltips work without it but the
  shared provider gives one consistent open-delay. Mount it once (§4).

## 3. Build the reusable helper (the core of this plan)

Create `src/components/common/HelpTip.tsx`:

```tsx
'use client'
import { CircleHelp } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { HelpTipProps } from '@/lib/types/store' // add interface there

// Icon trigger + content. Use beside labels/headers for "what is this?".
export function HelpTip({ text, side = 'top', className }: HelpTipProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        aria-label={text}
        className={cn('inline-flex text-muted-foreground hover:text-foreground', className)}
      >
        <CircleHelp className="size-3.5" aria-hidden />
      </TooltipTrigger>
      <TooltipContent side={side}>{text}</TooltipContent>
    </Tooltip>
  )
}
```

Add the prop interface to `lib/types/store.ts` (per DRY rule 3 — no per-file
`*Props`):
```ts
export interface HelpTipProps { text: string; side?: 'top'|'bottom'|'left'|'right'; className?: string }
```

For **icon-only action buttons** (Edit/Delete/Approve etc.) that today rely on a
bare `title=""` attr, wrap with `Tooltip`/`TooltipTrigger asChild`/`TooltipContent`
directly — OR add a tiny second helper `IconTipButton` if the pattern repeats > 4×.
Decide while implementing; keep it DRY.

## 4. Mount the provider

In `src/app/(admin)/admin/layout.tsx`, wrap the shell in `<TooltipProvider
delay={200}>`. Add a second `TooltipProvider` in `src/app/(store)/layout.tsx`
only if storefront tooltips (§7) are kept. Do not mount globally in root layout
unless both need it — keep blast radius small.

## 5. i18n — one namespace for all tooltip copy

In `src/lib/i18n/en.ts`, add a `tooltips` object (sibling of `admin`). Group by
area. Keep copy short (≤ ~12 words), plain, merchant-friendly. Examples:

```ts
tooltips: {
  product: {
    slug: 'The URL-friendly name. Auto-made from the title; change only if needed.',
    sku: 'Your internal code for this item. Optional.',
    stock: 'Units available. Hits 0 → shown as out of stock.',
    compareAt: 'Original price shown struck-through next to the sale price.',
    variant: 'A version of this product, e.g. a color. Each can have its own image.',
    sizeRow: 'A size with its own price, stock, and SKU.',
  },
  coupon: {
    type: 'Percent off the cart, or a fixed amount off.',
    minOrder: 'Cart must reach this total before the coupon applies.',
    usageLimit: 'Total times this code can be used across all customers.',
    perCustomer: 'Times one customer can reuse this code.',
    stripe: 'Synced to Stripe so it also works at card checkout.',
  },
  settings: {
    primaryColor: 'Main brand color — buttons and links.',
    accentColor: 'Highlights and focus rings.',
    radius: 'How rounded corners look across the store.',
    colorMode: 'Default light/dark for new visitors.',
    freeShipThreshold: 'Spend this much and shipping is free.',
  },
  analytics: {
    aov: 'Average order value — revenue ÷ number of orders.',
    funnel: 'How many visitors move from viewing to buying.',
    turnover: 'How fast stock sells; low = slow mover.',
    abandoned: 'Checkouts started but not completed.',
  },
  dashboard: {
    revenue: 'Paid + COD orders in the selected period.',
  },
} as const
```
(Fill in real keys to match the actual fields you find in each form — the list
above is the starting set, extend as needed. Never inline the string in JSX.)

## 6. Apply across admin (the bulk of the work)

For each, add `<HelpTip text={en.tooltips.X.Y} />` next to the field **label**
(inside the label row), table **column header**, or metric title. Use
`FormField` (`src/components/common/FormField.tsx`) as the seam — if it renders
the label, add an optional `help?: string` prop to it and render `HelpTip` when
present. That single change wires tooltips into every form field that uses
`FormField` (best DRY path — check how many forms use it first).

Targets:

| File | Add tooltips to |
|------|-----------------|
| `components/admin/products/ProductForm.tsx` | slug, sku, stock, compare-at price, variant section, size-row columns |
| `components/admin/coupons/CouponForm.tsx` | type, min order, max discount, usage limit, per-customer limit, Stripe sync toggle |
| `app/(admin)/admin/settings/page.tsx` | primary/accent color, radius, font, color mode, free-ship threshold, any tax fields |
| `components/admin/shared/StatCard.tsx` | add optional `help?: string` prop → `HelpTip` next to title; pass from dashboard/analytics |
| `app/(admin)/admin/page.tsx` | revenue/orders stat cards, recent-orders status meaning |
| `app/(admin)/admin/analytics/page.tsx` + `analytics/*Tab.tsx` | AOV, funnel steps, turnover, abandoned-checkout, table header metrics |
| `components/admin/orders/OrdersTable.tsx` | Method + Status column headers (what each status means) |
| `components/admin/coupons/CouponsTable.tsx` | Stripe column, Uses column |
| `components/admin/pos/POSScreen.tsx` | any non-obvious control (e.g. manual discount, payment method) |

For icon-only action buttons that currently use `title=` (e.g.
`AdminReviewRow.tsx` approve/reject, `CouponsTable.tsx` edit/delete), convert
the `title` to a real tooltip via the wrap pattern in §3 so they're consistent
and keyboard/touch-discoverable. Keep `aria-label` for a11y.

## 7. Storefront (light touch — optional, gate behind user OK)

Only where genuinely helpful, e.g.:
- `components/store/cart/FreeShippingBar.tsx` — explain the threshold.
- `components/store/checkout/CheckoutMethodSelector.tsx` — one line per payment
  method (what COD / bank transfer means).
- `components/store/product/SizePicker.tsx` — size guide hint (if copy exists).

If kept, mount `TooltipProvider` in `(store)/layout.tsx` (§4).

## 8. A11y + mobile notes

- base-ui tooltips are hover/focus; on touch they open on tap of the trigger —
  fine for the `CircleHelp` icon trigger. Ensure triggers are `type="button"`
  so they don't submit forms.
- Every trigger needs `aria-label` (HelpTip already sets it from `text`).
- Keep `TooltipContent` short; it has `max-w-xs` built in.

## 9. Acceptance

- `HelpTip` is the ONLY tooltip-composition site (grep: no inline
  `TooltipTrigger` scattered across feature files except the shared helper(s)).
- All tooltip copy lives under `en.tooltips.*` — no hardcoded strings in JSX.
- `TooltipProvider` mounted in admin layout (and store layout if §7 done).
- No Recharts/UI `Tooltip` import collision (feature files import `HelpTip`, not `Tooltip`).
- `pnpm lint` + `pnpm typecheck` clean.

## 10. Commits

1. `feat(ui): HelpTip reusable tooltip helper + HelpTipProps type + provider mount`
2. `feat(i18n): tooltips namespace (product, coupon, settings, analytics, dashboard)`
3. `feat(admin): field + column tooltips — product & coupon forms`
4. `feat(admin): field tooltips — settings + stat cards`
5. `feat(admin): metric tooltips — analytics + dashboard + orders/coupons tables`
6. `feat(admin): convert icon-button title attrs to tooltips (reviews, coupons, pos)`
7. *(optional, if §7)* `feat(store): light-touch tooltips on cart/checkout/size`

---

> Verify each field/column name against the live file before writing copy — the
> i18n keys in §5 are a starting set; match them to what actually renders.
