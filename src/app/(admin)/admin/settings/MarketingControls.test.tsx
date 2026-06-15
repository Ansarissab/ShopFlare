// @vitest-environment jsdom
/**
 * Tests for MarketingControls (Phase 32).
 * Mounts the full settings page — same pattern as LocaleControls.test.tsx.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react'
import AdminSettingsPage from './page'
import type { StoreConfig } from '@/lib/types/common'
import { en } from '@/lib/i18n/en'

vi.setConfig({ testTimeout: 20000 })

// ── Heavy deps ──────────────────────────────────────────────────────────────

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/components/shared/RichText', async () => {
  const { createElement } = await import('react')
  return { RichText: () => createElement('div', { 'data-testid': 'rich-text' }) }
})
vi.mock('next/image', async () => {
  const { createElement } = await import('react')
  return {
    default: (props: Record<string, unknown>) => {
      const { fill, priority, unoptimized, sizes, ...rest } = props
      return createElement('img', rest)
    },
  }
})

const apiPutMock = vi.fn()
vi.mock('@/lib/api', () => ({
  apiPut: (...args: unknown[]) => apiPutMock(...args),
  apiUpload: vi.fn().mockResolvedValue({ logoUrl: '' }),
  apiDelete: vi.fn().mockResolvedValue({}),
}))

let mockConfig: Partial<StoreConfig> | null = null
vi.mock('@/hooks/useStoreConfig', () => ({
  useStoreConfig: () => ({ config: mockConfig, loading: false }),
}))
vi.mock('@/hooks/useApiResource', () => ({
  useApiResource: () => ({ data: null }),
  DATA_UPDATED_CHANNEL: 'data-updated',
}))

// ── Helpers ─────────────────────────────────────────────────────────────────

const BASE_CONFIG: StoreConfig = {
  storeName: 'Test Store',
  currency: 'PKR',
  flatShippingRateCents: 0,
  freeShippingThresholdCents: 0,
  enabledLocales: ['en'],
  defaultLocale: 'en',
} as unknown as StoreConfig

function renderPage() {
  return render(<AdminSettingsPage />)
}

async function clickSave() {
  const allButtons = screen.getAllByRole('button')
  const saveBtn = allButtons.find((b) => b.textContent?.trim() === en.admin.save)
  if (!saveBtn) throw new Error('Save button not found')
  await act(async () => {
    fireEvent.click(saveBtn)
    await new Promise((r) => setTimeout(r, 50))
  })
}

// ── Setup / Teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  mockConfig = null
  apiPutMock.mockResolvedValue({})
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  apiPutMock.mockResolvedValue({})
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Admin settings — MarketingControls (Phase 32)', () => {
  it('renders the Verification section heading', () => {
    renderPage()
    expect(screen.getByText(en.seo.verificationSectionTitle)).toBeTruthy()
  })

  it('renders the Marketing section heading', () => {
    renderPage()
    expect(screen.getByText(en.seo.marketingSectionTitle)).toBeTruthy()
  })

  it('seeds GA4 ID from config', () => {
    mockConfig = { ...BASE_CONFIG, ga4MeasurementId: 'G-TEST1234' }
    renderPage()
    const input = screen.getByPlaceholderText('G-XXXXXXXXXX') as HTMLInputElement
    expect(input.value).toBe('G-TEST1234')
  })

  it('seeds Google site verification from config', () => {
    mockConfig = { ...BASE_CONFIG, googleSiteVerification: 'abc123verify' }
    renderPage()
    const input = screen.getByPlaceholderText(
      'google-site-verification content value',
    ) as HTMLInputElement
    expect(input.value).toBe('abc123verify')
  })

  it('seeds cookieConsentEnabled from config (false)', () => {
    mockConfig = { ...BASE_CONFIG, cookieConsentEnabled: false }
    renderPage()
    const checkbox = screen.getByRole('checkbox', {
      name: en.seo.cookieConsentEnabledLabel,
    }) as HTMLInputElement
    expect(checkbox.checked).toBe(false)
  })

  it('cookieConsentEnabled defaults to true when absent from config', () => {
    mockConfig = { ...BASE_CONFIG }
    renderPage()
    const checkbox = screen.getByRole('checkbox', {
      name: en.seo.cookieConsentEnabledLabel,
    }) as HTMLInputElement
    expect(checkbox.checked).toBe(true)
  })

  it('changing GA4 ID surfaces in PUT payload', async () => {
    mockConfig = { ...BASE_CONFIG }
    renderPage()
    const input = screen.getByPlaceholderText('G-XXXXXXXXXX')
    fireEvent.change(input, { target: { value: 'G-NEWID1234' } })
    await clickSave()
    await waitFor(() => expect(apiPutMock).toHaveBeenCalled())
    const payload = apiPutMock.mock.calls[0][1] as Record<string, unknown>
    expect(payload.ga4MeasurementId).toBe('G-NEWID1234')
  })

  it('changing verification input surfaces in PUT payload', async () => {
    mockConfig = { ...BASE_CONFIG }
    renderPage()
    const input = screen.getByPlaceholderText('google-site-verification content value')
    fireEvent.change(input, { target: { value: 'verifyXYZ' } })
    await clickSave()
    await waitFor(() => expect(apiPutMock).toHaveBeenCalled())
    const payload = apiPutMock.mock.calls[0][1] as Record<string, unknown>
    expect(payload.googleSiteVerification).toBe('verifyXYZ')
  })

  it('toggling cookieConsent changes value in PUT payload', async () => {
    mockConfig = { ...BASE_CONFIG, cookieConsentEnabled: true }
    renderPage()
    const checkbox = screen.getByRole('checkbox', { name: en.seo.cookieConsentEnabledLabel })
    fireEvent.click(checkbox)
    await clickSave()
    await waitFor(() => expect(apiPutMock).toHaveBeenCalled())
    const payload = apiPutMock.mock.calls[0][1] as Record<string, unknown>
    expect(payload.cookieConsentEnabled).toBe(false)
  })

  it('Generate button fills indexNowKey with a valid 32-char alphanumeric key', async () => {
    mockConfig = { ...BASE_CONFIG }
    renderPage()

    const generateBtn = screen.getByText(en.seo.indexNowGenerate)
    fireEvent.click(generateBtn)

    const input = screen.getByPlaceholderText('your-indexnow-key') as HTMLInputElement
    await waitFor(() => expect(input.value.length).toBeGreaterThan(0))

    expect(input.value).toMatch(/^[a-zA-Z0-9]{32}$/)
  })

  it('sends indexNowKey in PUT payload after generation', async () => {
    mockConfig = { ...BASE_CONFIG }
    renderPage()

    const generateBtn = screen.getByText(en.seo.indexNowGenerate)
    fireEvent.click(generateBtn)

    const input = screen.getByPlaceholderText('your-indexnow-key') as HTMLInputElement
    await waitFor(() => expect(input.value.length).toBeGreaterThan(0))

    await clickSave()
    await waitFor(() => expect(apiPutMock).toHaveBeenCalled())
    const payload = apiPutMock.mock.calls[0][1] as Record<string, unknown>
    expect(typeof payload.indexNowKey).toBe('string')
    expect((payload.indexNowKey as string).length).toBe(32)
    expect(payload.indexNowKey).toMatch(/^[a-zA-Z0-9]+$/)
  })
})
