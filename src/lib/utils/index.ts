import { CURRENCIES, DEFAULT_CURRENCY, type CurrencyCode } from '@/lib/constants'
import type { VariantWithDetails, SizeOption, ProductImage } from '@/lib/types/store'

export function formatPrice(cents: number, currency: CurrencyCode = DEFAULT_CURRENCY): string {
  const { symbol, decimals } = CURRENCIES[currency]
  const amount = cents / Math.pow(10, decimals)
  return `${symbol}${amount.toLocaleString('en', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
}

export function calculateShipping(subtotalCents: number, flatRateCents: number, thresholdCents: number): number {
  if (thresholdCents > 0 && subtotalCents >= thresholdCents) return 0
  return flatRateCents
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
export function getPriceRange(sizes: SizeOption[]): { minPrice: number | null; maxPrice: number | null } {
  const prices = sizes
    .filter(s => s.active && s.stock !== 0)
    .map(s => s.priceCents)
  if (prices.length === 0) return { minPrice: null, maxPrice: null }
  return {
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
  }
}

// NOTE: cn() lives in @/lib/utils (shadcn root) — re-exported here for convenience
export { cn } from '@/lib/utils'
