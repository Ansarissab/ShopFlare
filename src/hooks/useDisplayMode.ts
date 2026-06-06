'use client'
import { useSyncExternalStore } from 'react'

export type DisplayMode = 'browser' | 'standalone' | 'fullscreen' | 'minimal-ui'

// Detect current display mode (SSR-safe — guards window access on the server)
function getSnapshot(): DisplayMode {
  if (typeof window === 'undefined') return 'browser'
  // iOS Safari sets navigator.standalone for home-screen web apps
  if ((navigator as Navigator & { standalone?: boolean }).standalone) {
    return 'standalone'
  }
  if (window.matchMedia('(display-mode: fullscreen)').matches) return 'fullscreen'
  if (window.matchMedia('(display-mode: standalone)').matches) return 'standalone'
  if (window.matchMedia('(display-mode: minimal-ui)').matches) return 'minimal-ui'
  return 'browser'
}

function getServerSnapshot(): DisplayMode {
  return 'browser'
}

// Subscribe to display-mode changes (e.g. user adds to home screen mid-session)
function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const queries = [
    '(display-mode: standalone)',
    '(display-mode: fullscreen)',
    '(display-mode: minimal-ui)',
  ].map((q) => window.matchMedia(q))
  queries.forEach((mql) => mql.addEventListener('change', onChange))
  return () => queries.forEach((mql) => mql.removeEventListener('change', onChange))
}

export function useDisplayMode(): DisplayMode {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export function useIsStandalone(): boolean {
  return useDisplayMode() === 'standalone'
}
