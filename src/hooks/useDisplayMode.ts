'use client'
import { useState, useEffect } from 'react'

export type DisplayMode = 'browser' | 'standalone' | 'fullscreen' | 'minimal-ui'

export function useDisplayMode(): DisplayMode {
  const [mode, setMode] = useState<DisplayMode>('browser')

  useEffect(() => {
    // Detect immediately after mount (SSR-safe — no window access in server)
    function detect(): DisplayMode {
      // iOS Safari sets navigator.standalone for home-screen web apps
      if ((navigator as Navigator & { standalone?: boolean }).standalone) {
        return 'standalone'
      }
      if (window.matchMedia('(display-mode: fullscreen)').matches) return 'fullscreen'
      if (window.matchMedia('(display-mode: standalone)').matches) return 'standalone'
      if (window.matchMedia('(display-mode: minimal-ui)').matches) return 'minimal-ui'
      return 'browser'
    }

    setMode(detect())

    // Listen for mode changes (e.g. user adds to home screen mid-session)
    const mql = window.matchMedia('(display-mode: standalone)')
    const handler = () => setMode(detect())
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return mode
}

export function useIsStandalone(): boolean {
  return useDisplayMode() === 'standalone'
}
