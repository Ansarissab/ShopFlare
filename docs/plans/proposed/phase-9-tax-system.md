# Plan 9 — Tax System

**Status:** proposed  
**Branch:** hardening/ship-readiness  
**Goal:** Optional per-store tax that, when enabled, applies in real-time with zero rebuild — shows tax label, rate, and amount in every totals surface.

---

## 1. Scope

### In (v1)
- Single flat-rate tax configured once per store (GST, VAT, Sales Tax, etc.)
- Tax-exclusive mode: added on top of order amount
- Tax-inclusive mode: embedded in product prices — extracted and displayed for transparency
- Configurable tax basis: subtotal only, or subtotal + shipping
- Tax applied after discount (consumer-friendly, post-discount base)
- Tax label shown everywhere order totals appear
- Tax persisted on order row (`taxCents`) — immutable snapshot at purchase time
- Stripe Checkout: tax as explicit line item (exclusive mode only)
- Optional tax registration number on receipts
- Admin settings section to configure all fields live

### Out (defer to v2)
- Per-product / per-category tax rates
- Multi-tier split tax (provincial + federal)
- Automatic jurisdiction detection (Stripe Tax API)
- Customer tax exemptions
- VAT invoice PDF generation
- Tax-on-shipping-only edge cases

---

## 2. Tax Model

### 2.1 Config Keys (stored in existing `storeConfig` D1 KV table)

| Key | Stored as | Default | Description |
|-----|-----------|---------|-------------|
| `taxEnabled` | `'true'` / `'false'` | `'false'` | Master on/off switch |
| `taxRate` | `'17'`, `'5.5'` | `'0'` | Percentage, max 2 decimal places |
| `taxName` | string | `'Tax'` | Label in UI: "GST", "VAT", "Sales Tax", "HST" |
| `taxInclusive` | `'true'` / `'false'` | `'false'` | true = price already includes tax |
| `taxBasis` | `'subtotal'` / `'subtotal_and_shipping'` | `'subtotal'` | What amount to apply tax to |
| `taxRegistrationNumber` | string | `''` | e.g. `NTN-1234567-8` — shown on receipts/tracking when set |

No new DB table. All 6 fields use the existing key-value pattern.

### 2.2 Calculation — Tax-Exclusive (add on top)

```
taxableBase = max(0, subtotal - discount)                     [taxBasis = 'subtotal']
taxableBase = max(0, subtotal - discount) + shipping          [taxBasis = 'subtotal_and_shipping']
taxCents    = round(taxableBase × rate / 100)
total       = subtotal + shipping − discount + taxCents
```

### 2.3 Calculation — Tax-Inclusive (extract for display)

```
base        = max(0, subtotal - discount)
taxCents    = round(base − base / (1 + rate / 100))           [display only — already in price]
total       = subtotal + shipping − discount                   [unchanged]
```

Tax-inclusive: total is the same as without tax. Tax line shown as `"GST included — ₨X"` for transparency.

### 2.4 Rounding

Always `Math.round()`. Integer cents. For PKR/BDT (0-decimal currencies), priceCents are already integers so the result is always a clean integer with no rounding artefact.

### 2.5 Discount Interaction

Tax applies to the **post-discount** base. Example with 17% GST exclusive, PKR:
```
Subtotal   ₨ 5,000
Coupon    -₨   500   (10% off)
Tax base   ₨ 4,500   ← discount already applied
GST 17%    ₨   765   = round(4500 × 0.17)
Shipping   ₨   250
─────────────────────
Total      ₨ 5,515
```

---

## 3. Data Changes

### 3.1 DB Migration

**File:** `worker/db/migrations/0003_add_tax_cents.sql`

```sql
ALTER TABLE orders ADD COLUMN tax_cents INTEGER NOT NULL DEFAULT 0;
```

Backward-safe: existing orders get `tax_cents = 0` (correct — no tax was charged).

### 3.2 Drizzle Schema

**File:** `worker/db/schema.ts`

Add to `orders` table after `discountCents`:
```ts
taxCents: integer('tax_cents').notNull().default(0),
```

---

## 4. Constants

**File:** `src/lib/constants/index.ts`

```ts
export const TAX_BASIS = {
  subtotal:              'subtotal',
  subtotalAndShipping:   'subtotal_and_shipping',
} as const
export type TaxBasis = keyof typeof TAX_BASIS
```

---

## 5. Zod Schema

**File:** `src/lib/schemas/config.ts`

```ts
import { TAX_BASIS } from '@/lib/constants'

export const taxConfigSchema = z.object({
  taxEnabled:              z.boolean().optional(),
  taxRate:                 z.number().min(0).max(100).optional(),
  taxName:                 z.string().min(1).max(30).optional(),
  taxInclusive:            z.boolean().optional(),
  taxBasis:                z.enum(Object.keys(TAX_BASIS) as [string, ...string[]]).optional(),
  taxRegistrationNumber:   z.string().max(50).optional(),
})
export type TaxConfigData = z.infer<typeof taxConfigSchema>
```

Merge into `storeConfigSchema`:
```ts
export const storeConfigSchema = z.object({ ...existing... })
  .merge(appearanceSchema)
  .merge(taxConfigSchema)
```

`updateConfigSchema` (used by `PUT /admin/config/store`) already derives from `storeConfigSchema.partial()` — nothing else to change there.

---

## 6. Utility Functions

**File:** `src/lib/utils/index.ts`  
Add two exports alongside existing `calculateShipping`:

```ts
export interface TaxCalculationInput {
  subtotalCents:  number
  shippingCents:  number
  discountCents:  number
  taxRate:        number    // 0–100 percentage
  taxInclusive:   boolean
  taxBasis:       string    // 'subtotal' | 'subtotal_and_shipping'
}

export function calculateTax(input: TaxCalculationInput): number {
  const { subtotalCents, shippingCents, discountCents, taxRate, taxInclusive, taxBasis } = input
  if (taxRate <= 0) return 0

  if (taxInclusive) {
    const base = Math.max(0, subtotalCents - discountCents)
    return Math.round(base - base / (1 + taxRate / 100))
  }

  const taxableBase =
    taxBasis === 'subtotal_and_shipping'
      ? Math.max(0, subtotalCents - discountCents) + shippingCents
      : Math.max(0, subtotalCents - discountCents)

  return Math.round(taxableBase * taxRate / 100)
}

export function calculateGrandTotal(
  subtotalCents: number,
  shippingCents: number,
  discountCents: number,
  taxCents:      number,
  taxInclusive:  boolean,
): number {
  if (taxInclusive) return Math.max(0, subtotalCents + shippingCents - discountCents)
  return Math.max(0, subtotalCents + shippingCents - discountCents + taxCents)
}
```

`calculateTax` is pure — no side effects, no I/O. Importable by both client components and the CF Worker.

---

## 7. Types

### 7.1 `src/lib/types/admin.ts`

Add `taxCents` to `AdminOrder` and `AdminOrderDetail`:
```ts
taxCents: number   // after discountCents
```

### 7.2 `src/lib/types/order.ts`

`TrackingOrder` currently missing `discountCents` (pre-existing gap). Fix both at once:
```ts
discountCents: number   // gap fix
taxCents:      number   // new
```

### 7.3 `src/lib/types/cart.ts`

Extend `CartSummaryProps` — CartSheet computes tax and passes down:
```ts
taxCents?:      number
taxName?:       string
taxRate?:       number
taxInclusive?:  boolean
```

---

## 8. i18n Strings

**File:** `src/lib/i18n/en.ts`

Add to `cart` namespace (used in CartSummary + OrderSummary):
```ts
tax:              'Tax',
taxIncluded:      '{name} included',   // "GST included"
taxRateLabel:     '{name} ({rate}%)',  // "GST (17%)"
```

Add to `admin` namespace (Tax section in settings):
```ts
taxSettings:               'Tax Settings',
taxSettingsHint:           'Configure GST, VAT, or Sales Tax. Leave disabled to show no tax.',
taxEnabled:                'Enable Tax',
taxName:                   'Tax Name',
taxNameHint:               'Shown to customers — e.g. GST, VAT, Sales Tax',
taxRate:                   'Tax Rate (%)',
taxRateHint:               'e.g. 17 for 17% GST',
taxInclusive:              'Prices Include Tax',
taxInclusiveHint:          'Enable if your prices already include tax (common for UK VAT)',
taxBasis:                  'Apply Tax To',
taxBasisSubtotal:          'Subtotal only',
taxBasisSubtotalShipping:  'Subtotal + Shipping',
taxRegistrationNumber:     'Tax Registration Number',
taxRegistrationHint:       'Optional — displayed on order receipts',
taxSaved:                  'Tax settings saved',
```

Total: ~16 new keys.

---

## 9. Worker Changes

### 9.1 `worker/lib/orders.ts` — Config + Calculation

Extend `OrderConfig` interface:
```ts
interface OrderConfig {
  flatRateCents:  number
  thresholdCents: number
  currency:       CurrencyCode
  taxEnabled:     boolean
  taxRate:        number
  taxInclusive:   boolean
  taxBasis:       string
}
```

Extend `getOrderConfig()` — add 4 keys to the `inArray` query:
```ts
inArray(schema.storeConfig.key, [
  'flatShippingRateCents',
  'freeShippingThresholdCents',
  'currency',
  'taxEnabled',
  'taxRate',
  'taxInclusive',
  'taxBasis',
])
```

Parse tax fields:
```ts
taxEnabled:  kv['taxEnabled']  === 'true',
taxRate:     Math.max(0, Number(kv['taxRate'] ?? '0') || 0),
taxInclusive: kv['taxInclusive'] === 'true',
taxBasis:    kv['taxBasis'] ?? 'subtotal',
```

Extend `CreateOrderResult`:
```ts
taxCents: number
```

In `createOrder()` — inject after shipping calc (line ~388):
```ts
const taxCents = config.taxEnabled
  ? calculateTax({
      subtotalCents,
      shippingCents,
      discountCents,
      taxRate:     config.taxRate,
      taxInclusive: config.taxInclusive,
      taxBasis:    config.taxBasis,
    })
  : 0

const totalCents = calculateGrandTotal(
  subtotalCents, shippingCents, discountCents, taxCents, config.taxInclusive,
)
```

Add `taxCents` to `db.insert(schema.orders).values(...)`.  
Add `taxCents` to return value.

### 9.2 `worker/routes/config.ts` — Assemble Tax Fields

Add 6 keys to assembled object:
```ts
taxEnabled:            kv['taxEnabled'] === 'true',
taxRate:               Number(kv['taxRate'] ?? '0') || 0,
taxName:               kv['taxName'] || 'Tax',
taxInclusive:          kv['taxInclusive'] === 'true',
taxBasis:              kv['taxBasis'] || 'subtotal',
taxRegistrationNumber: kv['taxRegistrationNumber'] || undefined,
```

### 9.3 `worker/routes/stripe.ts` — Tax Line Item

After `createOrder()` returns `taxCents`, before creating the Stripe session:

```ts
const { orderId, taxCents } = await createOrder(db, { ... })

// Read taxInclusive + taxName + taxRate for the line item label
// (already fetched inside createOrder; pass through or re-read from result)
```

Extend `CreateOrderResult` to include `taxName`, `taxRate`, `taxInclusive`.  
In session creation, after mapping `line_items` from `items`:

```ts
if (taxCents > 0 && !taxInclusive) {
  line_items.push({
    price_data: {
      currency: currencyCode.toLowerCase(),
      unit_amount: taxCents,
      product_data: { name: `${taxName} (${taxRate}%)` },
    },
    quantity: 1,
  })
}
```

Tax-inclusive: Stripe prices already include tax. No extra line item.

### 9.4 Tracking Route

Wherever the worker assembles the `TrackingOrder` response, add:
```ts
discountCents: order.discountCents,   // gap fix
taxCents:      order.taxCents,
```

---

## 10. Storefront Changes

### 10.1 `src/components/store/checkout/OrderSummary.tsx`

`useStoreConfig()` already called. Extend:
```ts
const taxEnabled    = config?.taxEnabled    ?? false
const taxRate       = config?.taxRate       ?? 0
const taxName       = config?.taxName       ?? 'Tax'
const taxInclusive  = config?.taxInclusive  ?? false
const taxBasis      = config?.taxBasis      ?? 'subtotal'

const taxCents = taxEnabled
  ? calculateTax({ subtotalCents, shippingCents, discountCents, taxRate, taxInclusive, taxBasis })
  : 0

const totalCents = calculateGrandTotal(subtotalCents, shippingCents, discountCents, taxCents, taxInclusive)
```

Add tax line between shipping and discount:
```tsx
{taxEnabled && taxCents > 0 && (
  <div className="flex justify-between">
    <span className="text-muted-foreground">
      {taxInclusive
        ? en.cart.taxIncluded.replace('{name}', taxName)
        : en.cart.taxRateLabel.replace('{name}', taxName).replace('{rate}', String(taxRate))}
    </span>
    <span className={taxInclusive ? 'text-muted-foreground text-xs' : ''}>
      {formatPrice(taxCents)}
    </span>
  </div>
)}
```

### 10.2 `src/components/store/cart/CartSummary.tsx`

Accept new props `taxCents`, `taxName`, `taxRate`, `taxInclusive` (all optional, default 0/false).  
Swap `totalCents = subtotalCents + shippingCents - discountCents` →  
`totalCents = calculateGrandTotal(subtotalCents, shippingCents, discountCents, taxCents ?? 0, taxInclusive ?? false)`

Add tax line after shipping, before discount (same pattern as OrderSummary).

**CartSheet caller** (`src/components/store/cart/CartSheet.tsx`):  
Already reads `config` via `useStoreConfig`. Compute tax there and pass as props to `CartSummary`.

### 10.3 `src/app/(store)/track/[orderId]/page.tsx`

`order.taxCents` and `order.discountCents` now in `TrackingOrder`.  
Add both lines to the totals section:
```tsx
{order.discountCents > 0 && (
  <div className="flex justify-between text-success">
    <span>{en.cart.couponApplied}</span>
    <span>-{formatPrice(order.discountCents)}</span>
  </div>
)}
{order.taxCents > 0 && (
  <div className="flex justify-between">
    <span className="text-muted-foreground">{en.cart.tax}</span>
    <span>{formatPrice(order.taxCents)}</span>
  </div>
)}
```

Also show `taxRegistrationNumber` in receipt footer when present (read from `useStoreConfig`).

---

## 11. Admin Changes

### 11.1 `src/app/(admin)/admin/settings/page.tsx` — Tax Section

New section above the existing Store Info section (below Appearance):

**Fields:**
1. Switch: Tax Enabled
2. `taxName` — Input (text, max 30)
3. `taxRate` — Input (number, 0–100, step 0.01)
4. Switch: Prices Include Tax (`taxInclusive`)
5. Select: Apply Tax To (`taxBasis`) — "Subtotal only" / "Subtotal + Shipping"
6. `taxRegistrationNumber` — Input (text, optional)

Live preview: small totals example card showing how a sample order (e.g. ₨5,000 subtotal) would look with current tax settings. Updates on every field change. Uses `calculateTax` + `calculateGrandTotal` directly.

**Save:** tax fields included in existing `PUT /api/admin/config/store` via `handleSave`.

### 11.2 `src/app/(admin)/admin/orders/[id]/page.tsx`

Add tax line to the order totals breakdown:
```tsx
{order.taxCents > 0 && (
  <div className="flex justify-between">
    <span className="text-muted-foreground">Tax</span>
    <span>{formatPrice(order.taxCents)}</span>
  </div>
)}
```

---

## 12. Tests

**File:** `src/lib/utils.test.ts` — extend existing file

Test cases for `calculateTax()`:
1. `taxEnabled = false` → 0
2. Exclusive 17%, subtotal only, no discount → `Math.round(5000 * 0.17) = 850`
3. Exclusive 17%, after discount applied → `Math.round(4500 * 0.17) = 765`
4. Inclusive 20% → `round(1200 - 1200/1.2) = 200`
5. Exclusive, subtotal_and_shipping basis → `round((4500 + 250) * 0.17) = 808`
6. taxRate = 0 → 0
7. Negative taxableBase (discount > subtotal) → 0 (max(0,...) guard)

Test cases for `calculateGrandTotal()`:
1. Exclusive: total includes taxCents
2. Inclusive: total unchanged regardless of taxCents value

---

## 13. Commit Sequence

| # | Commit message |
|---|---------------|
| 1 | `feat(schema): add taxConfigSchema merged into storeConfigSchema` |
| 2 | `feat(constants): add TAX_BASIS constant` |
| 3 | `feat(db): migration 0003 — add tax_cents column to orders` |
| 4 | `feat(utils): add calculateTax + calculateGrandTotal` |
| 5 | `feat(types): add taxCents to AdminOrder, TrackingOrder (+ discountCents gap fix), CartSummaryProps` |
| 6 | `feat(i18n): add 16 tax strings` |
| 7 | `feat(worker): read tax config in getOrderConfig + inject calculateTax in createOrder` |
| 8 | `feat(worker): assemble tax fields in config GET` |
| 9 | `feat(stripe): add tax as line item in checkout session (exclusive mode only)` |
| 10 | `feat(storefront): tax line in OrderSummary + CartSummary with real-time preview` |
| 11 | `feat(track): tax + discount lines on order tracking page` |
| 12 | `feat(admin): tax line in order detail + Tax section in settings with live preview` |
| 13 | `test: calculateTax + calculateGrandTotal unit tests` |
| 14 | `docs(plans): move phase-9-tax-system to done` |

---

## 14. Audit Checklist

- [ ] typecheck clean
- [ ] all tests pass
- [ ] `taxEnabled = false` → no tax line shown anywhere, `taxCents = 0` on orders
- [ ] Exclusive mode: `total = subtotal + shipping − discount + tax`
- [ ] Inclusive mode: `total` unchanged, tax line shows "GST included — ₨X"
- [ ] `taxBasis = subtotal_and_shipping`: shipping included in tax base
- [ ] Post-discount: tax base uses `subtotal − discount`
- [ ] Stripe session: tax line item present (exclusive, taxCents > 0)
- [ ] Stripe session: no tax line item (inclusive or taxCents = 0)
- [ ] Existing orders (`taxCents = 0`): no tax line rendered
- [ ] PKR/BDT (0-decimal): no fractional amounts
- [ ] `taxRegistrationNumber` shown on tracking page only when set and non-empty
- [ ] Admin live preview card updates in real-time without saving
- [ ] `pnpm typecheck` clean
- [ ] `pnpm test` all pass
