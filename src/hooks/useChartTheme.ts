'use client'

import { useState, useEffect } from 'react'

export interface ChartTheme {
  fg: string
  mutedFg: string
  border: string
  accent: string
}

const DEFAULTS: ChartTheme = {
  fg: '#1A1A18',
  mutedFg: '#6B6B62',
  border: '#E2E2DA',
  accent: '#4A7C6F',
}

function readTokens(): ChartTheme {
  if (typeof document === 'undefined') return DEFAULTS
  const style = getComputedStyle(document.documentElement)
  const get = (v: string) => style.getPropertyValue(v).trim()
  return {
    fg: get('--fg') || DEFAULTS.fg,
    mutedFg: get('--muted-fg') || DEFAULTS.mutedFg,
    border: get('--border') || DEFAULTS.border,
    accent: get('--accent') || DEFAULTS.accent,
  }
}

/**
 * Reads design-system CSS vars for use in Recharts props.
 * Safe for SSR (returns light-mode defaults on the server).
 * Re-reads whenever the `data-theme` attribute changes on <html>
 * (i.e. when the user toggles dark mode).
 */
export function useChartTheme(): ChartTheme {
  const [theme, setTheme] = useState<ChartTheme>(DEFAULTS)

  useEffect(() => {
    // Read on first mount (tokens are available in the browser)
    setTheme(readTokens())

    // Re-read on theme attribute mutations
    const observer = new MutationObserver(() => setTheme(readTokens()))
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class'],
    })
    return () => observer.disconnect()
  }, [])

  return theme
}
