// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { applyTheme, THEME_STORAGE_KEY } from '@/lib/theme'
import { RADIUS_PRESETS, FONT_PRESETS, DENSITY_PRESETS } from '@/lib/constants'
import { contrastColor } from '@/lib/utils'

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  // reset inline styles + attribute between cases
  document.documentElement.removeAttribute('style')
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.removeAttribute('data-hero-style')
})

describe('THEME_STORAGE_KEY', () => {
  it('is the stable storage key', () => {
    expect(THEME_STORAGE_KEY).toBe('shopflare-theme')
  })
})

describe('applyTheme', () => {
  const root = () => document.documentElement

  it('sets primary + accent colors and derives FG via contrastColor', () => {
    applyTheme({ primaryColor: '#000000', accentColor: '#ffffff' })
    expect(root().style.getPropertyValue('--store-primary')).toBe('#000000')
    expect(root().style.getPropertyValue('--store-accent')).toBe('#ffffff')
    // dark primary → white fg; light accent → black fg
    expect(root().style.getPropertyValue('--store-primary-fg')).toBe(contrastColor('#000000'))
    expect(root().style.getPropertyValue('--store-accent-fg')).toBe(contrastColor('#ffffff'))
  })

  it('uses explicit FG overrides when provided (skips contrastColor)', () => {
    applyTheme({
      primaryColor: '#123456',
      primaryColorFg: '#abcdef',
      accentColor: '#654321',
      accentColorFg: '#fedcba',
    })
    expect(root().style.getPropertyValue('--store-primary-fg')).toBe('#abcdef')
    expect(root().style.getPropertyValue('--store-accent-fg')).toBe('#fedcba')
  })

  it('does not set any var when colors are absent', () => {
    applyTheme({})
    expect(root().style.getPropertyValue('--store-primary')).toBe('')
    expect(root().style.getPropertyValue('--store-primary-fg')).toBe('')
    expect(root().style.getPropertyValue('--store-accent')).toBe('')
  })

  it('maps radius preset to --radius', () => {
    applyTheme({ radius: 'lg' })
    expect(root().style.getPropertyValue('--radius')).toBe(RADIUS_PRESETS.lg)
  })

  it('maps font preset to --store-font', () => {
    applyTheme({ fontFamily: 'serif' })
    expect(root().style.getPropertyValue('--store-font')).toBe(FONT_PRESETS.serif)
  })

  it('colorMode dark forces data-theme=dark', () => {
    applyTheme({ colorMode: 'dark' })
    expect(root().getAttribute('data-theme')).toBe('dark')
  })

  it('colorMode light forces data-theme=light', () => {
    applyTheme({ colorMode: 'light' })
    expect(root().getAttribute('data-theme')).toBe('light')
  })

  it('colorMode system resolves dark when prefers-color-scheme matches', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: true,
        media: '',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    )
    applyTheme({ colorMode: 'system' })
    expect(root().getAttribute('data-theme')).toBe('dark')
  })

  it('colorMode system resolves light when prefers-color-scheme does not match', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: false,
        media: '',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    )
    applyTheme({ colorMode: 'system' })
    expect(root().getAttribute('data-theme')).toBe('light')
  })

  it('leaves data-theme untouched when colorMode absent', () => {
    applyTheme({ primaryColor: '#abcdef' })
    expect(root().getAttribute('data-theme')).toBeNull()
  })

  it('maps density preset to --density', () => {
    applyTheme({ density: 'compact' })
    expect(root().style.getPropertyValue('--density')).toBe(DENSITY_PRESETS.compact)
  })

  it('maps spacious density to --density', () => {
    applyTheme({ density: 'spacious' })
    expect(root().style.getPropertyValue('--density')).toBe(DENSITY_PRESETS.spacious)
  })

  it('does not set --density when density absent', () => {
    applyTheme({})
    expect(root().style.getPropertyValue('--density')).toBe('')
  })

  it('sets data-hero-style when heroStyle provided', () => {
    applyTheme({ heroStyle: 'centered' })
    expect(root().getAttribute('data-hero-style')).toBe('centered')
  })

  it('sets data-hero-style for all supported hero styles', () => {
    for (const style of ['image-left', 'full-bleed', 'centered', 'split'] as const) {
      applyTheme({ heroStyle: style })
      expect(root().getAttribute('data-hero-style')).toBe(style)
    }
  })

  it('does not touch data-hero-style when heroStyle absent', () => {
    applyTheme({})
    expect(root().getAttribute('data-hero-style')).toBeNull()
  })
})
