// @vitest-environment jsdom
/**
 * Focused test for the locale controls added to AdminSettingsPage (Phase 28).
 * We mount the full page but mock all IO so only the locale UI is under test.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react'
import AdminSettingsPage from './page'
import type { StoreConfig } from '@/lib/types/common'
import { en } from '@/lib/i18n/en'

// This suite mounts the FULL settings page (every section, including the heavy
// Select-based controls) just to exercise the locale checkboxes. A single
// save-and-assert renders the whole tree several times, so under heavy CI
// concurrency the default 5s ceiling can be hit even though the test does ~500ms
// of real work in isolation. Give it explicit headroom — the work is bounded, the
// timeout only absorbs scheduler contention.
vi.setConfig({ testTimeout: 20000 })

// ── Heavy deps — mock everything that isn't the locale UI ─────────────────────

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

// apiPut spy — module factory closes over this ref; reset impl in beforeEach
const apiPutMock = vi.fn()
vi.mock('@/lib/api', () => ({
  apiPut: (...args: unknown[]) => apiPutMock(...args),
  apiUpload: vi.fn().mockResolvedValue({ logoUrl: '' }),
  apiDelete: vi.fn().mockResolvedValue({}),
}))

// useStoreConfig — we control the seeded config per test
let mockConfig: Partial<StoreConfig> | null = null
vi.mock('@/hooks/useStoreConfig', () => ({
  useStoreConfig: () => ({ config: mockConfig, loading: false }),
}))
vi.mock('@/hooks/useApiResource', () => ({
  useApiResource: () => ({ data: null }),
  DATA_UPDATED_CHANNEL: 'data-updated',
}))

// ── helpers ────────────────────────────────────────────────────────────────────

/** Minimal complete StoreConfig — only fields the useEffect seeds matter here. */
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

/** Find and click the top-level Save button (the one in AdminPageHeader actions). */
async function clickSave() {
  // Find by text — base-ui button's accessible name equals its text content
  const allButtons = screen.getAllByRole('button')
  const saveBtn = allButtons.find((b) => b.textContent?.trim() === en.admin.save)
  if (!saveBtn) throw new Error('Save button not found')
  await act(async () => {
    fireEvent.click(saveBtn)
    // Allow the async handleSave to resolve
    await new Promise((r) => setTimeout(r, 50))
  })
}

// ── setup / teardown ───────────────────────────────────────────────────────────

beforeEach(() => {
  mockConfig = null
  apiPutMock.mockResolvedValue({})
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  // Restore implementation after clearAllMocks wipes it
  apiPutMock.mockResolvedValue({})
})

// ── tests ──────────────────────────────────────────────────────────────────────

describe('Admin settings — locale controls', () => {
  it('renders the Languages section heading', () => {
    renderPage()
    expect(screen.getByText(en.admin.localesHeading)).toBeTruthy()
  })

  it('renders checkboxes for all shipped locales', () => {
    renderPage()
    expect(screen.getByLabelText('English')).toBeTruthy()
    expect(screen.getByLabelText('Français')).toBeTruthy()
    expect(screen.getByLabelText('اردو')).toBeTruthy()
  })

  it('English checkbox is always checked and disabled', () => {
    renderPage()
    const enBox = screen.getByLabelText('English') as HTMLInputElement
    expect(enBox.checked).toBe(true)
    expect(enBox.disabled).toBe(true)
  })

  it('seeds enabledLocales from config', () => {
    mockConfig = { ...BASE_CONFIG, enabledLocales: ['en', 'fr'], defaultLocale: 'en' }
    renderPage()
    const frBox = screen.getByLabelText('Français') as HTMLInputElement
    const urBox = screen.getByLabelText('اردو') as HTMLInputElement
    expect(frBox.checked).toBe(true)
    expect(urBox.checked).toBe(false)
  })

  it('checking a locale adds it to enabledLocales in the save payload', async () => {
    mockConfig = { ...BASE_CONFIG, enabledLocales: ['en'], defaultLocale: 'en' }
    renderPage()
    fireEvent.click(screen.getByLabelText('Français'))
    await clickSave()
    await waitFor(() => expect(apiPutMock).toHaveBeenCalled())
    const payload = apiPutMock.mock.calls[0][1] as Record<string, unknown>
    expect((payload.enabledLocales as string[]).sort()).toEqual(['en', 'fr'].sort())
  })

  it('unchecking a locale removes it from the payload', async () => {
    mockConfig = { ...BASE_CONFIG, enabledLocales: ['en', 'fr'], defaultLocale: 'en' }
    renderPage()
    fireEvent.click(screen.getByLabelText('Français'))
    await clickSave()
    await waitFor(() => expect(apiPutMock).toHaveBeenCalled())
    const payload = apiPutMock.mock.calls[0][1] as Record<string, unknown>
    expect(payload.enabledLocales).toEqual(['en'])
  })

  it('unchecking the defaultLocale resets defaultLocale to en', async () => {
    mockConfig = { ...BASE_CONFIG, enabledLocales: ['en', 'fr'], defaultLocale: 'fr' }
    renderPage()
    // Uncheck fr — which is currently the default
    fireEvent.click(screen.getByLabelText('Français'))
    await clickSave()
    await waitFor(() => expect(apiPutMock).toHaveBeenCalled())
    const payload = apiPutMock.mock.calls[0][1] as Record<string, unknown>
    expect(payload.defaultLocale).toBe('en')
  })

  it('sends enabledLocales and defaultLocale in the save payload', async () => {
    mockConfig = { ...BASE_CONFIG, enabledLocales: ['en', 'ur'], defaultLocale: 'en' }
    renderPage()
    await clickSave()
    await waitFor(() => expect(apiPutMock).toHaveBeenCalled())
    const payload = apiPutMock.mock.calls[0][1] as Record<string, unknown>
    expect((payload.enabledLocales as string[]).sort()).toEqual(['en', 'ur'].sort())
    expect(payload.defaultLocale).toBe('en')
  })
})

// ── FAQ seeding migration tests (Phase 30) ────────────────────────────────────

describe('Admin settings — FAQ items seeding (Phase 30)', () => {
  it('seeds faqItems from config.faqItems when present', async () => {
    mockConfig = {
      ...BASE_CONFIG,
      faqEnabled: true,
      faqItems: [{ question: 'Q from config', answer: '<p>A from config</p>' }],
    }
    renderPage()
    // After the useEffect seeds, the FAQ question input should be visible
    await waitFor(() => {
      expect(screen.getByDisplayValue('Q from config')).toBeTruthy()
    })
  })

  it('migrates legacy faqContent to faqItems when faqItems is absent', async () => {
    mockConfig = {
      ...BASE_CONFIG,
      faqEnabled: true,
      // No faqItems — only legacy faqContent
      faqContent: '<h3>Legacy question?</h3><p>Legacy answer.</p>',
    }
    renderPage()
    await waitFor(() => {
      expect(screen.getByDisplayValue('Legacy question?')).toBeTruthy()
    })
  })

  it('starts with empty FAQ list when both faqItems and faqContent are absent', async () => {
    mockConfig = { ...BASE_CONFIG, faqEnabled: true }
    renderPage()
    // The empty-state text should appear (no items seeded)
    await waitFor(() => {
      expect(screen.getByText(en.admin.faqEmptyState)).toBeTruthy()
    })
  })

  it('prefers faqItems over faqContent when both are present', async () => {
    mockConfig = {
      ...BASE_CONFIG,
      faqEnabled: true,
      faqItems: [{ question: 'Structured question', answer: '<p>Structured answer</p>' }],
      faqContent: '<h3>Legacy question?</h3><p>Legacy answer.</p>',
    }
    renderPage()
    await waitFor(() => {
      expect(screen.getByDisplayValue('Structured question')).toBeTruthy()
    })
    expect(screen.queryByDisplayValue('Legacy question?')).toBeNull()
  })
})
