'use client'

import { useState, useEffect } from 'react'
import { WifiOff } from 'lucide-react'
import { en } from '@/lib/i18n/en'

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setIsOffline(!navigator.onLine)

    const handleOffline = () => setIsOffline(true)
    const handleOnline = () => setIsOffline(false)

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  if (!mounted || !isOffline) return null

  return (
    <div className="fixed top-[var(--safe-top,0)] left-0 right-0 z-50 flex items-center justify-center gap-2 bg-yellow-500/90 px-4 py-2 text-sm font-medium text-yellow-950 backdrop-blur-sm">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>{en.pwa.offlineTitle}</span>
    </div>
  )
}
