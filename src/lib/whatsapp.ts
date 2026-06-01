import { formatPrice } from '@/lib/utils/index'
import type { CurrencyCode } from '@/lib/constants'

export type WhatsAppOrderParams = {
  phoneNumber: string
  productName: string
  variantLabel: string
  size: string
  sku?: string
  priceCents: number
  currency: CurrencyCode
  quantity: number
}

export function buildWhatsAppOrderUrl(params: WhatsAppOrderParams): string {
  const { phoneNumber, productName, variantLabel, size, sku, priceCents, currency, quantity } = params

  const formattedPrice = formatPrice(priceCents * quantity, currency)

  const lines = [
    "Hi! I'd like to order:",
    `Product: ${productName}`,
    `Color/Variant: ${variantLabel}`,
    `Size: ${size}`,
    ...(sku ? [`SKU: ${sku}`] : []),
    `Qty: ${quantity}`,
    `Price: ${formattedPrice}`,
    '',
    'Please confirm availability and delivery details.',
  ]

  const message = lines.join('\n')
  return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`
}
