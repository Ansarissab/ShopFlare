import { CURRENCIES, type CurrencyCode } from '@/lib/constants'

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

// NOTE: cn() lives in @/lib/utils (shadcn root) — re-exported here for convenience
export { cn } from '@/lib/utils'
