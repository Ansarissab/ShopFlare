// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { LocaleSwitcher } from './LocaleSwitcher'
import { TProvider } from '@/lib/i18n/Provider'

// ── next/navigation mocks ──────────────────────────────────────────────────────

let mockPathname = '/shop'
let mockSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
}))

// ── useStoreConfig mock ────────────────────────────────────────────────────────

let mockConfig: Record<string, unknown> | null = null

vi.mock('@/hooks/useStoreConfig', () => ({
  useStoreConfig: () => ({ config: mockConfig }),
}))

// ── window.location.assign mock ────────────────────────────────────────────────

const assignMock = vi.fn()

// ── cookie mock ────────────────────────────────────────────────────────────────

let cookieJar = ''

// ── helpers ────────────────────────────────────────────────────────────────────

function renderSwitcher(locale: 'en' | 'fr' | 'ur' = 'en') {
  return render(
    <TProvider locale={locale}>
      <LocaleSwitcher />
    </TProvider>,
  )
}

// ── setup / teardown ───────────────────────────────────────────────────────────

beforeEach(() => {
  mockConfig = null
  mockPathname = '/shop'
  mockSearchParams = new URLSearchParams()
  cookieJar = ''
  assignMock.mockClear()

  // Stub window.location.assign
  Object.defineProperty(window, 'location', {
    value: { assign: assignMock },
    writable: true,
    configurable: true,
  })

  // Stub document.cookie setter so we can capture it
  Object.defineProperty(document, 'cookie', {
    set(value: string) {
      cookieJar = value
    },
    get() {
      return cookieJar
    },
    configurable: true,
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// ── tests ──────────────────────────────────────────────────────────────────────

describe('LocaleSwitcher', () => {
  it('renders nothing when enabledLocales is empty / has only one entry', () => {
    mockConfig = { enabledLocales: ['en'], defaultLocale: 'en' }
    const { container } = renderSwitcher()
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when config is null (defaults to single locale)', () => {
    mockConfig = null
    const { container } = renderSwitcher()
    expect(container.firstChild).toBeNull()
  })

  it('renders a trigger button when more than one locale is enabled', () => {
    mockConfig = { enabledLocales: ['en', 'fr'], defaultLocale: 'en' }
    renderSwitcher()
    expect(screen.getByRole('button', { name: 'Language' })).toBeTruthy()
  })

  it('shows locale labels in the dropdown when opened', () => {
    mockConfig = { enabledLocales: ['en', 'fr', 'ur'], defaultLocale: 'en' }
    renderSwitcher()
    fireEvent.click(screen.getByRole('button', { name: 'Language' }))
    expect(screen.getByText('English')).toBeTruthy()
    expect(screen.getByText('Français')).toBeTruthy()
    expect(screen.getByText('اردو')).toBeTruthy()
  })

  it('navigates to prefixed path when selecting a non-default locale', () => {
    mockConfig = { enabledLocales: ['en', 'fr'], defaultLocale: 'en' }
    mockPathname = '/shop'
    renderSwitcher('en')
    fireEvent.click(screen.getByRole('button', { name: 'Language' }))
    fireEvent.click(screen.getByText('Français'))
    expect(assignMock).toHaveBeenCalledWith('/fr/shop')
  })

  it('navigates to unprefixed path when selecting the default locale', () => {
    mockConfig = { enabledLocales: ['en', 'fr'], defaultLocale: 'en' }
    mockPathname = '/fr/shop'
    renderSwitcher('fr')
    fireEvent.click(screen.getByRole('button', { name: 'Language' }))
    fireEvent.click(screen.getByText('English'))
    expect(assignMock).toHaveBeenCalledWith('/shop')
  })

  it('strips existing locale prefix before building the new URL', () => {
    mockConfig = { enabledLocales: ['en', 'fr', 'ur'], defaultLocale: 'en' }
    // Current page is /fr/product/slug, switching to Urdu
    mockPathname = '/fr/product/slug'
    renderSwitcher('fr')
    fireEvent.click(screen.getByRole('button', { name: 'Language' }))
    fireEvent.click(screen.getByText('اردو'))
    expect(assignMock).toHaveBeenCalledWith('/ur/product/slug')
  })

  it('preserves query string in the navigated URL', () => {
    mockConfig = { enabledLocales: ['en', 'fr'], defaultLocale: 'en' }
    mockPathname = '/shop'
    mockSearchParams = new URLSearchParams('q=shoes')
    renderSwitcher('en')
    fireEvent.click(screen.getByRole('button', { name: 'Language' }))
    fireEvent.click(screen.getByText('Français'))
    expect(assignMock).toHaveBeenCalledWith('/fr/shop?q=shoes')
  })

  it('sets the NEXT_LOCALE cookie when navigating', () => {
    mockConfig = { enabledLocales: ['en', 'fr'], defaultLocale: 'en' }
    renderSwitcher('en')
    fireEvent.click(screen.getByRole('button', { name: 'Language' }))
    fireEvent.click(screen.getByText('Français'))
    expect(cookieJar).toContain('NEXT_LOCALE=fr')
  })

  it('does not navigate when selecting the already-active locale', () => {
    mockConfig = { enabledLocales: ['en', 'fr'], defaultLocale: 'en' }
    renderSwitcher('en')
    fireEvent.click(screen.getByRole('button', { name: 'Language' }))
    fireEvent.click(screen.getByText('English'))
    expect(assignMock).not.toHaveBeenCalled()
  })

  it('unprefixed path "/" stays "/" when switching to non-default locale', () => {
    mockConfig = { enabledLocales: ['en', 'fr'], defaultLocale: 'en' }
    mockPathname = '/'
    renderSwitcher('en')
    fireEvent.click(screen.getByRole('button', { name: 'Language' }))
    fireEvent.click(screen.getByText('Français'))
    expect(assignMock).toHaveBeenCalledWith('/fr/')
  })
})
