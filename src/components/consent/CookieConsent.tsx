'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useConsent } from '@/lib/consent/ConsentProvider'
import { useT } from '@/lib/i18n/Provider'

export interface CookieConsentProps {
  enabled: boolean
  hasTags: boolean
}

export function CookieConsent({ enabled, hasTags }: CookieConsentProps) {
  const t = useT()
  const { consented, ready, accept, decline } = useConsent()

  // Render only when: merchant enabled consent gate, at least one marketing ID
  // is configured, the cookie has been read client-side, and the visitor hasn't
  // yet made a choice (consented === null).
  if (!enabled || !hasTags || !ready || consented !== null) return null

  return (
    <div
      role="region"
      aria-label={t.consent.message}
      className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6 lg:px-8">
        <p className="text-sm text-foreground">
          {t.consent.message}{' '}
          <Link
            href="/policy/privacy"
            className="underline underline-offset-2 hover:text-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {t.consent.privacyLink}
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={decline}>
            {t.consent.decline}
          </Button>
          <Button size="sm" onClick={accept}>
            {t.consent.accept}
          </Button>
        </div>
      </div>
    </div>
  )
}
