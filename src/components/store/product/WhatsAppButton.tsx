'use client'

import { MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { en } from '@/lib/i18n/en'
import { buildWhatsAppOrderUrl } from '@/lib/whatsapp'
import type { CurrencyCode } from '@/lib/constants'

interface WhatsAppButtonProps {
  phoneNumber: string
  productName: string
  variantLabel: string
  size: string
  sku?: string
  priceCents: number
  currency: CurrencyCode
  quantity?: number
  disabled?: boolean
}

export function WhatsAppButton({
  phoneNumber,
  productName,
  variantLabel,
  size,
  sku,
  priceCents,
  currency,
  quantity = 1,
  disabled = false,
}: WhatsAppButtonProps) {
  function handleClick() {
    if (disabled) return
    const url = buildWhatsAppOrderUrl({
      phoneNumber,
      productName,
      variantLabel,
      size,
      sku,
      priceCents,
      currency,
      quantity,
    })
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <Button
      // WhatsApp brand green — intentional exception to CSS var rule
      className="gap-2 bg-[#25D366] text-white hover:bg-[#20BD5A] disabled:opacity-50"
      disabled={disabled}
      onClick={handleClick}
    >
      <MessageCircle className="size-4" />
      {en.store.orderOnWhatsApp}
    </Button>
  )
}
