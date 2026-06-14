// @vitest-environment jsdom
/**
 * Unit tests for AnnouncementControls admin component (Phase 29c).
 * Mirrors LocaleControls.test.tsx style.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react'
import {
  AnnouncementControls,
  utcIsoToLocalInput,
  localInputToUtcIso,
} from './AnnouncementControls'
import { MAX_ANNOUNCEMENT_MESSAGES } from '@/lib/constants'
import { en } from '@/lib/i18n/en'
import type { StoreConfig } from '@/lib/types/common'

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const apiPutMock = vi.fn()
vi.mock('@/lib/api', () => ({
  apiPut: (...args: unknown[]) => apiPutMock(...args),
}))

vi.mock('@/lib/i18n/Provider', () => ({
  useT: () => en,
}))

vi.mock('@/hooks/useApiResource', () => ({
  useApiResource: () => ({ data: null }),
  DATA_UPDATED_CHANNEL: 'data-updated',
}))

// ── helpers ────────────────────────────────────────────────────────────────────

const BASE_CONFIG: Partial<StoreConfig> = {
  storeName: 'Test Store',
  announcementEnabled: false,
  announcementType: 'single',
  announcementMessages: [{ text: '' }],
  announcementVersion: 0,
} as Partial<StoreConfig>

function renderControls(config: Partial<StoreConfig> | null = BASE_CONFIG) {
  return render(<AnnouncementControls config={config as StoreConfig | null} />)
}

async function clickSave() {
  const btn = screen.getByRole('button', { name: en.admin.saveAnnouncement })
  await act(async () => {
    fireEvent.click(btn)
    await new Promise((r) => setTimeout(r, 50))
  })
}

// ── setup / teardown ───────────────────────────────────────────────────────────

beforeEach(() => {
  apiPutMock.mockResolvedValue({})
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  apiPutMock.mockResolvedValue({})
})

// ── tests ──────────────────────────────────────────────────────────────────────

describe('AnnouncementControls', () => {
  it('renders the section heading', () => {
    renderControls()
    expect(screen.getByText(en.admin.announcementBarHeading)).toBeTruthy()
  })

  it('renders enable toggle as unchecked by default', () => {
    renderControls()
    const cb = screen.getByRole('checkbox') as HTMLInputElement
    expect(cb.checked).toBe(false)
  })

  it('seeds enabled from config', () => {
    renderControls({ ...BASE_CONFIG, announcementEnabled: true } as Partial<StoreConfig>)
    const cb = screen.getByRole('checkbox') as HTMLInputElement
    expect(cb.checked).toBe(true)
  })

  it('hides message editor when disabled', () => {
    renderControls({ ...BASE_CONFIG, announcementEnabled: false } as Partial<StoreConfig>)
    expect(screen.queryByText(en.admin.announcementMessages)).toBeNull()
  })

  it('shows message editor when enabled', () => {
    renderControls({ ...BASE_CONFIG, announcementEnabled: true } as Partial<StoreConfig>)
    expect(screen.getByText(en.admin.announcementMessages)).toBeTruthy()
  })

  it('Save button is labelled saveAnnouncement (not the generic save)', () => {
    renderControls()
    expect(screen.getByRole('button', { name: en.admin.saveAnnouncement })).toBeTruthy()
    expect(screen.queryByRole('button', { name: en.admin.save })).toBeNull()
  })

  it('calls apiPut with announcementEnabled on save', async () => {
    renderControls()
    await clickSave()
    await waitFor(() => expect(apiPutMock).toHaveBeenCalled())
    const payload = apiPutMock.mock.calls[0][1] as Record<string, unknown>
    expect(payload).toHaveProperty('announcementEnabled')
  })

  it('bumps announcementVersion on save (version + 1)', async () => {
    renderControls({ ...BASE_CONFIG, announcementVersion: 4 } as Partial<StoreConfig>)
    await clickSave()
    await waitFor(() => expect(apiPutMock).toHaveBeenCalled())
    const payload = apiPutMock.mock.calls[0][1] as Record<string, unknown>
    expect(payload.announcementVersion).toBe(5)
  })

  it('bumps version from 0 when version is unset', async () => {
    renderControls({ ...BASE_CONFIG, announcementVersion: undefined } as Partial<StoreConfig>)
    await clickSave()
    await waitFor(() => expect(apiPutMock).toHaveBeenCalled())
    const payload = apiPutMock.mock.calls[0][1] as Record<string, unknown>
    expect(payload.announcementVersion).toBe(1)
  })

  describe('type switching', () => {
    it('shows type selector when enabled', () => {
      renderControls({ ...BASE_CONFIG, announcementEnabled: true } as Partial<StoreConfig>)
      // The type selector trigger should be present
      expect(screen.getByText(en.admin.announcementType)).toBeTruthy()
    })
  })

  describe('add / remove messages (rotating)', () => {
    it('shows add message button when type is rotating and under max', () => {
      renderControls({
        ...BASE_CONFIG,
        announcementEnabled: true,
        announcementType: 'rotating',
        announcementMessages: [{ text: 'A' }],
      } as Partial<StoreConfig>)
      expect(screen.getByRole('button', { name: /add message/i })).toBeTruthy()
    })

    it('can add messages up to MAX_ANNOUNCEMENT_MESSAGES', async () => {
      renderControls({
        ...BASE_CONFIG,
        announcementEnabled: true,
        announcementType: 'rotating',
        announcementMessages: [{ text: 'A' }],
      } as Partial<StoreConfig>)

      // Add until we hit MAX (start with 1, add MAX-1 more)
      for (let i = 0; i < MAX_ANNOUNCEMENT_MESSAGES - 1; i++) {
        // If button still exists (not hidden yet), click
        const btn = screen.queryByRole('button', { name: /add message/i })
        if (btn) {
          await act(async () => fireEvent.click(btn))
        }
      }

      // Add button should now be hidden (at or above max)
      const btnAfter = screen.queryByRole('button', { name: /add message/i })
      expect(btnAfter).toBeNull()
    })

    it('save payload includes only messages with non-empty text', async () => {
      renderControls({
        ...BASE_CONFIG,
        announcementEnabled: true,
        announcementType: 'rotating',
        announcementMessages: [{ text: 'Valid' }, { text: '' }],
      } as Partial<StoreConfig>)
      await clickSave()
      await waitFor(() => expect(apiPutMock).toHaveBeenCalled())
      const payload = apiPutMock.mock.calls[0][1] as Record<string, unknown>
      const msgs = payload.announcementMessages as Array<{ text: string }>
      expect(msgs.every((m) => m.text.trim().length > 0)).toBe(true)
    })
  })

  describe('scheduled type', () => {
    it('shows schedule start/end inputs when type is scheduled', () => {
      renderControls({
        ...BASE_CONFIG,
        announcementEnabled: true,
        announcementType: 'scheduled',
      } as Partial<StoreConfig>)
      expect(screen.getByText(en.admin.announcementScheduleStart)).toBeTruthy()
      expect(screen.getByText(en.admin.announcementScheduleEnd)).toBeTruthy()
    })

    it('sends announcementStart and announcementEnd as UTC ISO strings in payload', async () => {
      // Use known UTC ISO values as config (stored format)
      const startUtc = '2026-01-01T00:00:00.000Z'
      const endUtc = '2026-12-31T23:59:00.000Z'
      renderControls({
        ...BASE_CONFIG,
        announcementEnabled: true,
        announcementType: 'scheduled',
        announcementStart: startUtc,
        announcementEnd: endUtc,
        announcementMessages: [{ text: 'Sale' }],
      } as Partial<StoreConfig>)
      await clickSave()
      await waitFor(() => expect(apiPutMock).toHaveBeenCalled())
      const payload = apiPutMock.mock.calls[0][1] as Record<string, unknown>
      // Must be UTC ISO strings (end with 'Z'), not raw local strings
      expect(typeof payload.announcementStart).toBe('string')
      expect((payload.announcementStart as string).endsWith('Z')).toBe(true)
      expect(typeof payload.announcementEnd).toBe('string')
      expect((payload.announcementEnd as string).endsWith('Z')).toBe(true)
    })

    it('omits announcementStart/End for non-scheduled type', async () => {
      renderControls({
        ...BASE_CONFIG,
        announcementEnabled: true,
        announcementType: 'single',
        announcementStart: '2026-01-01T00:00:00.000Z',
        announcementEnd: '2026-12-31T23:59:00.000Z',
        announcementMessages: [{ text: 'Sale' }],
      } as Partial<StoreConfig>)
      await clickSave()
      await waitFor(() => expect(apiPutMock).toHaveBeenCalled())
      const payload = apiPutMock.mock.calls[0][1] as Record<string, unknown>
      expect(payload.announcementStart).toBeUndefined()
      expect(payload.announcementEnd).toBeUndefined()
    })
  })
})

// ── Timezone helper unit tests ─────────────────────────────────────────────────

describe('utcIsoToLocalInput', () => {
  it('returns empty string for empty input', () => {
    expect(utcIsoToLocalInput('')).toBe('')
  })

  it('returns empty string for invalid ISO', () => {
    expect(utcIsoToLocalInput('not-a-date')).toBe('')
  })

  it('produces a YYYY-MM-DDTHH:mm string (no seconds, no Z)', () => {
    const result = utcIsoToLocalInput('2026-06-15T12:00:00.000Z')
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  })

  it('round-trips with localInputToUtcIso (timezone-agnostic)', () => {
    // Pick a local string, convert to UTC, then convert back — must match original
    const local = '2026-12-24T09:30'
    const utc = localInputToUtcIso(local)
    expect(utc).toBeDefined()
    const roundTripped = utcIsoToLocalInput(utc!)
    expect(roundTripped).toBe(local)
  })
})

describe('localInputToUtcIso', () => {
  it('returns undefined for empty string', () => {
    expect(localInputToUtcIso('')).toBeUndefined()
  })

  it('returns undefined for invalid input', () => {
    expect(localInputToUtcIso('not-a-date')).toBeUndefined()
  })

  it('returns a Z-suffixed UTC ISO string', () => {
    const result = localInputToUtcIso('2026-06-15T09:30')
    expect(result).toBeDefined()
    expect(result!.endsWith('Z')).toBe(true)
  })

  it('round-trips with utcIsoToLocalInput (timezone-agnostic)', () => {
    // Start from a UTC ISO, seed a local string, re-encode to UTC — must match original
    const utc = '2026-01-01T18:30:00.000Z'
    const local = utcIsoToLocalInput(utc)
    const roundTripped = localInputToUtcIso(local)
    // The roundtrip may differ in milliseconds representation; compare parsed times
    expect(roundTripped).toBeDefined()
    expect(new Date(roundTripped!).getTime()).toBe(new Date(utc).getTime())
  })
})
