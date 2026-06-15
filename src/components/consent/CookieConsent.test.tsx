// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { CookieConsent } from './CookieConsent'
import { en } from '@/lib/i18n/en'

// ── useT mock ─────────────────────────────────────────────────────────────────
vi.mock('@/lib/i18n/Provider', () => ({
  useT: () => en,
  useLocale: () => 'en',
}))

// ── useConsent mock ───────────────────────────────────────────────────────────
const mockAccept = vi.fn()
const mockDecline = vi.fn()
let mockConsented: boolean | null = null
let mockReady = true

vi.mock('@/lib/consent/ConsentProvider', () => ({
  ConsentProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useConsent: () => ({
    consented: mockConsented,
    ready: mockReady,
    accept: mockAccept,
    decline: mockDecline,
  }),
}))

// ── helpers ───────────────────────────────────────────────────────────────────

function renderBanner(overrides: Partial<{ enabled: boolean; hasTags: boolean }> = {}) {
  return render(<CookieConsent enabled={true} hasTags={true} {...overrides} />)
}

beforeEach(() => {
  mockConsented = null
  mockReady = true
  mockAccept.mockClear()
  mockDecline.mockClear()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// ── tests ─────────────────────────────────────────────────────────────────────

describe('CookieConsent', () => {
  it('hidden when enabled=false', () => {
    renderBanner({ enabled: false, hasTags: true })
    expect(screen.queryByRole('region')).toBeNull()
  })

  it('hidden when hasTags=false', () => {
    renderBanner({ enabled: true, hasTags: false })
    expect(screen.queryByRole('region')).toBeNull()
  })

  it('hidden when consented is already true (already accepted)', () => {
    mockConsented = true
    renderBanner()
    expect(screen.queryByRole('region')).toBeNull()
  })

  it('hidden when consented is already false (already declined)', () => {
    mockConsented = false
    renderBanner()
    expect(screen.queryByRole('region')).toBeNull()
  })

  it('hidden when not ready (cookie not yet read)', () => {
    mockReady = false
    mockConsented = null
    renderBanner()
    expect(screen.queryByRole('region')).toBeNull()
  })

  it('visible when enabled, hasTags, ready, and consented is null', () => {
    renderBanner()
    expect(screen.getByRole('region')).toBeTruthy()
    expect(screen.getByText(en.consent.message)).toBeTruthy()
  })

  it('calls accept() when Accept button is clicked', () => {
    renderBanner()
    const acceptBtn = screen.getByRole('button', { name: en.consent.accept })
    fireEvent.click(acceptBtn)
    expect(mockAccept).toHaveBeenCalledOnce()
    expect(mockDecline).not.toHaveBeenCalled()
  })

  it('calls decline() when Decline button is clicked', () => {
    renderBanner()
    const declineBtn = screen.getByRole('button', { name: en.consent.decline })
    fireEvent.click(declineBtn)
    expect(mockDecline).toHaveBeenCalledOnce()
    expect(mockAccept).not.toHaveBeenCalled()
  })

  it('renders a privacy policy link', () => {
    renderBanner()
    const link = screen.getByRole('link', { name: en.consent.privacyLink })
    expect(link).toBeTruthy()
    expect((link as HTMLAnchorElement).href).toContain('/policy/privacy')
  })
})
