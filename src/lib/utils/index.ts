import { CURRENCIES, DEFAULT_CURRENCY, type CurrencyCode } from '@/lib/constants'
import type { VariantWithDetails, SizeOption, ProductImage } from '@/lib/types/product'

export function formatPrice(cents: number, currency: CurrencyCode = DEFAULT_CURRENCY): string {
  const { symbol, decimals } = CURRENCIES[currency]
  const amount = cents / Math.pow(10, decimals)
  return `${symbol}${amount.toLocaleString('en', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
}

export function calculateShipping(
  subtotalCents: number,
  flatRateCents: number,
  thresholdCents: number,
): number {
  if (thresholdCents > 0 && subtotalCents >= thresholdCents) return 0
  return flatRateCents
}

export interface TaxCalculationInput {
  subtotalCents: number
  shippingCents: number
  discountCents: number
  taxRate: number
  taxInclusive: boolean
  taxBasis: string
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

  return Math.round((taxableBase * taxRate) / 100)
}

export function calculateGrandTotal(
  subtotalCents: number,
  shippingCents: number,
  discountCents: number,
  taxCents: number,
  taxInclusive: boolean,
): number {
  if (taxInclusive) return Math.max(0, subtotalCents + shippingCents - discountCents)
  return Math.max(0, subtotalCents + shippingCents - discountCents + taxCents)
}

/** Builds per-variant lookup maps for images and sizes. */
export function buildProductMaps(variants: VariantWithDetails[]): {
  sizesByVariant: Record<string, SizeOption[]>
  imagesByVariant: Record<string, ProductImage[]>
} {
  const sizesByVariant: Record<string, SizeOption[]> = {}
  const imagesByVariant: Record<string, ProductImage[]> = {}
  for (const v of variants) {
    sizesByVariant[v.id] = v.sizes
    imagesByVariant[v.id] = v.images
  }
  return { sizesByVariant, imagesByVariant }
}

/**
 * Returns the min/max priceCents across active, in-stock sizes.
 * Returns null for both if no eligible sizes exist.
 */
export function getPriceRange(sizes: SizeOption[]): {
  minPrice: number | null
  maxPrice: number | null
} {
  const prices = sizes.filter((s) => s.active && s.stock !== 0).map((s) => s.priceCents)
  if (prices.length === 0) return { minPrice: null, maxPrice: null }
  return {
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
  }
}

// NOTE: cn() lives in @/lib/utils (shadcn root) — re-exported here for convenience
export { cn } from '@/lib/utils'

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

/** Formats an ISO date string as short month + day, e.g. "Jun 14". */
export function shortDay(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// SQLite datetime('now') returns 'YYYY-MM-DD HH:MM:SS' — space separator, no T,
// no Z. Safari rejects this as invalid; Chrome/Firefox are lenient. Normalize to
// strict ISO 8601 UTC before constructing a Date so all browsers agree.
export function formatDate(
  val: string | null | undefined,
  opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' },
  locale: string | undefined = 'en',
): string {
  if (!val) return ''
  const iso = val.includes('T') ? val : val.replace(' ', 'T') + 'Z'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString(locale, opts)
}
