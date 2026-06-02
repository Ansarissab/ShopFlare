// Worker-local money formatter — mirrors @/lib/utils formatPrice WITHOUT pulling
// the client util graph (clsx/tailwind-merge/zustand + the client type graph)
// into the worker bundle. Shared by email.ts (order receipts) and orders.ts
// (coupon min-order messages) so the cents→display logic lives in one place.

import { CURRENCIES } from '@/lib/constants'
import type { CurrencyCode } from '@/lib/constants'

export function formatCents(cents: number, currency: CurrencyCode): string {
  const { symbol, decimals } = CURRENCIES[currency]
  const amount = cents / Math.pow(10, decimals)
  return `${symbol}${amount.toLocaleString('en', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
}
