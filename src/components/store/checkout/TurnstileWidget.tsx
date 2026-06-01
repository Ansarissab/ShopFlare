'use client'

import { useEffect, useRef } from 'react'
import type { TurnstileWidgetProps } from '@/lib/types/store'

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        options: {
          sitekey: string
          callback: (token: string) => void
          'error-callback': () => void
          'expired-callback': () => void
          theme?: 'light' | 'dark' | 'auto'
        }
      ) => string
      reset: (widgetId: string) => void
      remove: (widgetId: string) => void
    }
    onTurnstileLoad?: () => void
  }
}

export function TurnstileWidget({ onVerify, onError }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)

  useEffect(() => {
    function renderWidget() {
      if (!containerRef.current || !window.turnstile) return
      if (widgetIdRef.current) return // already rendered

      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: SITE_KEY,
        callback: onVerify,
        'error-callback': () => {
          onError?.()
        },
        'expired-callback': () => {
          onError?.()
        },
        theme: 'auto',
      })
    }

    if (window.turnstile) {
      renderWidget()
      return
    }

    // Script not yet loaded — attach a callback and inject script once
    window.onTurnstileLoad = renderWidget

    const existing = document.querySelector(
      'script[src*="turnstile"]'
    ) as HTMLScriptElement | null

    if (!existing) {
      const script = document.createElement('script')
      script.src =
        'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit'
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current)
        widgetIdRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div ref={containerRef} className="mt-2" />
}
