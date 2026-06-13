// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { AdminLocaleSwitcher } from './AdminLocaleSwitcher'
import { TProvider } from '@/lib/i18n/Provider'

// ── next/navigation mocks ──────────────────────────────────────────────────────

let mockPathname = '/admin/orders'
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
      <AdminLocaleSwitcher />
    </TProvider>,
  )
}

// ── setup / teardown ───────────────────────────────────────────────────────────

beforeEach(() => {
  mockConfig = null
  mockPathname = '/admin/orders'
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

describe('AdminLocaleSwitcher', () => {
  it('renders nothing when enabledLocales has only one entry', () => {
    mockConfig = { enabledLocales: ['en'] }
    const { container } = renderSwitcher()
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when config is null (defaults to single locale)', () => {
    mockConfig = null
    const { container } = renderSwitcher()
    expect(container.firstChild).toBeNull()
  })

  it('renders a trigger button when more than one locale is enabled', () => {
    mockConfig = { enabledLocales: ['en', 'fr'] }
    renderSwitcher()
    expect(screen.getByRole('button', { name: 'Language' })).toBeTruthy()
  })

  it('shows locale labels in the dropdown when opened', () => {
    mockConfig = { enabledLocales: ['en', 'fr', 'ur'] }
    renderSwitcher()
    fireEvent.click(screen.getByRole('button', { name: 'Language' }))
    expect(screen.getByText('English')).toBeTruthy()
    expect(screen.getByText('Français')).toBeTruthy()
    expect(screen.getByText('اردو')).toBeTruthy()
  })

  it('navigates to prefixed admin path when selecting a non-default locale', () => {
    mockConfig = { enabledLocales: ['en', 'fr'] }
    mockPathname = '/admin/orders'
    renderSwitcher('en')
    fireEvent.click(screen.getByRole('button', { name: 'Language' }))
    fireEvent.click(screen.getByText('Français'))
    expect(assignMock).toHaveBeenCalledWith('/fr/admin/orders')
  })

  it('navigates to unprefixed /admin/... when selecting English (DEFAULT_LOCALE)', () => {
    mockConfig = { enabledLocales: ['en', 'fr'] }
    mockPathname = '/fr/admin/orders'
    renderSwitcher('fr')
    fireEvent.click(screen.getByRole('button', { name: 'Language' }))
    fireEvent.click(screen.getByText('English'))
    expect(assignMock).toHaveBeenCalledWith('/admin/orders')
  })

  it('strips existing locale prefix before building the new URL', () => {
    mockConfig = { enabledLocales: ['en', 'fr', 'ur'] }
    // Currently on /fr/admin/settings, switching to Urdu
    mockPathname = '/fr/admin/settings'
    renderSwitcher('fr')
    fireEvent.click(screen.getByRole('button', { name: 'Language' }))
    fireEvent.click(screen.getByText('اردو'))
    expect(assignMock).toHaveBeenCalledWith('/ur/admin/settings')
  })

  it('preserves query string in the navigated URL', () => {
    mockConfig = { enabledLocales: ['en', 'fr'] }
    mockPathname = '/admin/orders'
    mockSearchParams = new URLSearchParams('status=pending')
    renderSwitcher('en')
    fireEvent.click(screen.getByRole('button', { name: 'Language' }))
    fireEvent.click(screen.getByText('Français'))
    expect(assignMock).toHaveBeenCalledWith('/fr/admin/orders?status=pending')
  })

  it('sets the NEXT_LOCALE cookie when navigating', () => {
    mockConfig = { enabledLocales: ['en', 'fr'] }
    renderSwitcher('en')
    fireEvent.click(screen.getByRole('button', { name: 'Language' }))
    fireEvent.click(screen.getByText('Français'))
    expect(cookieJar).toContain('NEXT_LOCALE=fr')
  })

  it('does not navigate when selecting the already-active locale', () => {
    mockConfig = { enabledLocales: ['en', 'fr'] }
    renderSwitcher('en')
    fireEvent.click(screen.getByRole('button', { name: 'Language' }))
    fireEvent.click(screen.getByText('English'))
    expect(assignMock).not.toHaveBeenCalled()
  })
})
