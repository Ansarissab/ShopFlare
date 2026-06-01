import { CURRENCIES, type CurrencyCode } from '@/lib/constants'
import type { VariantWithDetails, SizeOption, ProductImage } from '@/lib/types/store'

export function formatPrice(cents: number, currency: CurrencyCode = 'PKR'): string {
  const { symbol, decimals } = CURRENCIES[currency]
  const amount = cents / Math.pow(10, decimals === 0 ? 0 : 2)
  return `${symbol}${amount.toLocaleString('en', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
}

export function generateOrderNumber(): string {
  // nanoid usage — called server-side in CF Worker
  return `ORD-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
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

// NOTE: cn() lives in @/lib/utils (shadcn root) — re-exported here for convenience
export { cn } from '@/lib/utils'
