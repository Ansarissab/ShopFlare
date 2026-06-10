import { formatPrice } from '@/lib/utils/index'
import { en } from '@/lib/i18n/en'
import type { WhatsAppOrderParams } from '@/lib/types/product'

function waUrl(phoneNumber: string, message: string): string {
  return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`
}

export function buildWhatsAppOrderUrl(params: WhatsAppOrderParams): string {
  const { phoneNumber, productName, variantLabel, size, sku, priceCents, currency, quantity } =
    params

  const formattedPrice = formatPrice(priceCents * quantity, currency)
  const w = en.whatsapp

  const lines = [
    w.greeting,
    `${w.product} ${productName}`,
    `${w.variant} ${variantLabel}`,
    `${w.size} ${size}`,
    ...(sku ? [`${w.sku} ${sku}`] : []),
    `${w.qty} ${quantity}`,
    `${w.price} ${formattedPrice}`,
    '',
    w.footer,
  ]

  return waUrl(phoneNumber, lines.join('\n'))
}

export function buildWhatsAppContactUrl(phoneNumber: string): string {
  return waUrl(phoneNumber, en.whatsapp.contactGreeting)
}
