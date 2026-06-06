// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ThemeProvider } from './ThemeProvider'
import { THEME_STORAGE_KEY } from '@/lib/theme'

const applyTheme = vi.fn()

vi.mock('@/lib/theme', () => ({
  applyTheme: (...args: unknown[]) => applyTheme(...args),
  THEME_STORAGE_KEY: 'shopflare-theme',
}))

let mockConfig: Record<string, unknown> | null = null
vi.mock('@/hooks/useStoreConfig', () => ({
  useStoreConfig: () => ({ config: mockConfig }),
}))

const fullConfig = {
  primaryColor: '#111111',
  primaryColorFg: '#ffffff',
  accentColor: '#222222',
  accentColorFg: '#eeeeee',
  radius: 'md',
  fontFamily: 'sans',
  colorMode: 'light',
  logoUrl: '/logo.png',
}

beforeEach(() => {
  mockConfig = null
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ThemeProvider', () => {
  it('renders children', () => {
    render(
      <ThemeProvider>
        <p>child-content</p>
      </ThemeProvider>,
    )
    expect(screen.getByText('child-content')).toBeTruthy()
  })

  it('does nothing when config is null', () => {
    render(<ThemeProvider>x</ThemeProvider>)
    expect(applyTheme).not.toHaveBeenCalled()
  })

  it('applies theme and writes snapshot to localStorage when config present', () => {
    mockConfig = fullConfig
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    render(<ThemeProvider>y</ThemeProvider>)

    expect(applyTheme).toHaveBeenCalledTimes(1)
    const snapshot = applyTheme.mock.calls[0][0]
    expect(snapshot).toEqual({
      primaryColor: '#111111',
      primaryColorFg: '#ffffff',
      accentColor: '#222222',
      accentColorFg: '#eeeeee',
      radius: 'md',
      fontFamily: 'sans',
      colorMode: 'light',
      logoUrl: '/logo.png',
    })
    expect(setItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, JSON.stringify(snapshot))
    setItem.mockRestore()
  })

  it('swallows localStorage errors (private browsing / quota)', () => {
    mockConfig = fullConfig
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    expect(() => render(<ThemeProvider>z</ThemeProvider>)).not.toThrow()
    expect(applyTheme).toHaveBeenCalledTimes(1)
    setItem.mockRestore()
  })

  it('renders without children prop', () => {
    expect(() => render(<ThemeProvider />)).not.toThrow()
  })
})
