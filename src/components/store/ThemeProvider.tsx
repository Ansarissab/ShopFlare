'use client'

import { useEffect } from 'react'
import { useStoreConfig } from '@/hooks/useStoreConfig'
import { applyTheme, THEME_STORAGE_KEY } from '@/lib/theme'
import type { ThemeSnapshot } from '@/lib/types'

/** Applies merchant theme from live store config to the DOM and caches a snapshot
 *  in localStorage for the no-flash boot script on next page load. */
export function ThemeProvider({ children }: { children?: React.ReactNode }) {
  const { config } = useStoreConfig()

  useEffect(() => {
    if (!config) return
    const snapshot: ThemeSnapshot = {
      primaryColor: config.primaryColor,
      primaryColorFg: config.primaryColorFg,
      accentColor: config.accentColor,
      accentColorFg: config.accentColorFg,
      radius: config.radius,
      fontFamily: config.fontFamily,
      colorMode: config.colorMode,
      density: config.density,
      heroStyle: config.heroStyle,
      logoUrl: config.logoUrl,
    }
    applyTheme(snapshot)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(snapshot))
    } catch {
      // silently ignore (private browsing / storage quota)
    }
  }, [config])

  return <>{children}</>
}
