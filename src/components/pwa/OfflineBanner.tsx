'use client'

import { useSyncExternalStore } from 'react'
import { WifiOff } from 'lucide-react'
import { en } from '@/lib/i18n/en'

function subscribe(onChange: () => void) {
  window.addEventListener('offline', onChange)
  window.addEventListener('online', onChange)
  return () => {
    window.removeEventListener('offline', onChange)
    window.removeEventListener('online', onChange)
  }
}

const getSnapshot = () => !navigator.onLine
// Server/hydration snapshot is "online" so nothing renders until mounted,
// preserving the prior mounted-gate hydration behavior.
const getServerSnapshot = () => false

export function OfflineBanner() {
  const isOffline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  if (!isOffline) return null

  return (
    <div className="fixed top-[var(--safe-top,0)] left-0 right-0 z-50 flex items-center justify-center gap-2 bg-yellow-500/90 px-4 py-2 text-sm font-medium text-yellow-950 backdrop-blur-sm">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>{en.pwa.offlineTitle}</span>
    </div>
  )
}
