'use client'

import { RADIUS_PRESETS, FONT_PRESETS } from '@/lib/constants'
import { contrastColor } from '@/lib/utils'
import type { ThemeSnapshot } from '@/lib/types'

export const THEME_STORAGE_KEY = 'shopflare-theme'

/** Applies theme snapshot to CSS custom properties and data-theme on <html>.
 *  Used live by ThemeProvider and mirrored by the inline boot script in layout.tsx. */
export function applyTheme(t: Partial<ThemeSnapshot>): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const set = (k: string, v: string | undefined) => { if (v) root.style.setProperty(k, v) }

  set('--store-primary',    t.primaryColor)
  set('--store-primary-fg', t.primaryColorFg ?? (t.primaryColor ? contrastColor(t.primaryColor) : undefined))
  set('--store-accent',     t.accentColor)
  set('--store-accent-fg',  t.accentColorFg ?? (t.accentColor ? contrastColor(t.accentColor) : undefined))

  if (t.radius)     set('--radius',     RADIUS_PRESETS[t.radius     as keyof typeof RADIUS_PRESETS])
  if (t.fontFamily) set('--store-font', FONT_PRESETS[t.fontFamily   as keyof typeof FONT_PRESETS])

  if (t.colorMode) {
    const dark =
      t.colorMode === 'dark' ||
      (t.colorMode === 'system' &&
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches)
    root.setAttribute('data-theme', dark ? 'dark' : 'light')
  }
}
