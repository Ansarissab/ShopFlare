'use client'

import { useState, useEffect, useSyncExternalStore } from 'react'
import { X, Share } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { en } from '@/lib/i18n/en'
import { INSTALL_DISMISSED_KEY } from '@/lib/constants'
import { useIsStandalone } from '@/hooks/useDisplayMode'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isIos(): boolean {
  if (typeof window === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isDismissed(): boolean {
  try {
    return localStorage.getItem(INSTALL_DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

function markDismissed(): void {
  try {
    localStorage.setItem(INSTALL_DISMISSED_KEY, '1')
  } catch {}
}

// Client-only "hydrated" flag via useSyncExternalStore: returns false on the
// server / first render and true once mounted, without a synchronous effect
// setState. No real subscription needed — the value never changes post-mount.
const emptySubscribe = () => () => {}
function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  )
}

export function InstallPrompt() {
  const isStandalone = useIsStandalone()
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIosSheet, setShowIosSheet] = useState(false)
  const [showBanner, setShowBanner] = useState(false)
  const mounted = useHydrated()

  useEffect(() => {
    if (isDismissed() || isStandalone) return

    // Android / Desktop: capture the native prompt
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShowBanner(true)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // iOS: show instructions if not installed and not dismissed
    // Delay to avoid showing immediately on first visit
    if (isIos() && !isStandalone) {
      const timer = setTimeout(() => {
        if (!isDismissed()) setShowIosSheet(true)
      }, 3000)
      return () => {
        window.removeEventListener('beforeinstallprompt', handler)
        clearTimeout(timer)
      }
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [isStandalone])

  if (!mounted || isStandalone || isDismissed()) return null

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') markDismissed()
    setDeferredPrompt(null)
    setShowBanner(false)
  }

  const handleDismiss = () => {
    markDismissed()
    setShowBanner(false)
    setShowIosSheet(false)
  }

  return (
    <>
      {/* Android/Desktop bottom install banner */}
      {showBanner && deferredPrompt && (
        <div className="fixed bottom-[var(--safe-bottom,0)] left-0 right-0 z-50 border-t bg-background p-3 sm:p-4 shadow-lg animate-in slide-in-from-bottom-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-medium text-sm">{en.pwa.installTitle}</p>
              <p className="text-xs text-muted-foreground truncate">{en.pwa.installBody}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleInstall} className="w-full sm:w-auto">
                {en.pwa.installAction}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDismiss}
                className="w-full sm:w-auto"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* iOS A2HS instruction sheet */}
      <Sheet
        open={showIosSheet}
        onOpenChange={(open) => {
          if (!open) handleDismiss()
        }}
      >
        <SheetContent side="bottom" className="pb-[calc(1.5rem+var(--safe-bottom,0px))]">
          <SheetHeader className="text-left">
            <SheetTitle>{en.pwa.installIosTitle}</SheetTitle>
            <SheetDescription>{en.pwa.installBody}</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                1
              </span>
              <span className="text-sm flex items-center gap-1">
                {en.pwa.installIosStep1} <Share className="inline h-4 w-4" />
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                2
              </span>
              <span className="text-sm">{en.pwa.installIosStep2}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                3
              </span>
              <span className="text-sm">{en.pwa.installIosStep3}</span>
            </div>
          </div>
          <Button className="mt-6 w-full" variant="outline" onClick={handleDismiss}>
            {en.pwa.installIosClose}
          </Button>
        </SheetContent>
      </Sheet>
    </>
  )
}
