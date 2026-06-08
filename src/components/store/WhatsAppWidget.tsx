'use client'

import { MessageCircle } from 'lucide-react'
import { useStoreConfig } from '@/hooks/useStoreConfig'
import { isFeatureEnabled } from '@/lib/features'
import { buildWhatsAppContactUrl } from '@/lib/whatsapp'
import { useIsStandalone } from '@/hooks/useDisplayMode'
import { en } from '@/lib/i18n/en'
import { cn } from '@/lib/utils'

export function WhatsAppWidget() {
  const { config } = useStoreConfig()
  const isStandalone = useIsStandalone()

  if (!isFeatureEnabled(config, 'whatsappEnabled') || !config?.whatsappNumber) {
    return null
  }

  const url = buildWhatsAppContactUrl(config.whatsappNumber)

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={en.store.whatsappWidgetLabel}
      className={cn(
        // WhatsApp brand green — intentional exception to CSS var rule (matches WhatsAppButton.tsx)
        'fixed right-4 z-50 flex size-14 items-center justify-center rounded-full',
        'bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2',
        isStandalone ? 'bottom-20' : 'bottom-4',
      )}
    >
      <MessageCircle className="size-7" aria-hidden />
    </a>
  )
}
