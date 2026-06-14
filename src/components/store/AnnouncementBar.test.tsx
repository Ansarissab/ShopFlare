// @vitest-environment jsdom
/**
 * Unit tests for AnnouncementBar component (Phase 29c).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { AnnouncementBar } from './AnnouncementBar'
import { ANNOUNCEMENT_DISMISS_KEY } from '@/lib/constants'
import type { StoreConfig } from '@/lib/types/common'

// ── Mock heavy deps ────────────────────────────────────────────────────────────

vi.mock('@/lib/i18n/Provider', () => ({
  useT: () => ({
    store: { dismissAnnouncement: 'Dismiss announcement', announcementBar: 'Announcement' },
  }),
}))

let mockConfig: Partial<StoreConfig> | null = null
vi.mock('@/hooks/useStoreConfig', () => ({
  useStoreConfig: () => ({ config: mockConfig, loading: false }),
}))

// ── localStorage helpers ───────────────────────────────────────────────────────

function clearStorage() {
  try {
    localStorage.removeItem(ANNOUNCEMENT_DISMISS_KEY)
  } catch {}
}

function setStoredVersion(v: number) {
  localStorage.setItem(ANNOUNCEMENT_DISMISS_KEY, String(v))
}

// ── matchMedia mock ────────────────────────────────────────────────────────────

function mockMatchMedia(prefersReduced: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn((query: string) => ({
      matches: query.includes('prefers-reduced-motion') ? prefersReduced : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

// ── helpers ────────────────────────────────────────────────────────────────────

function renderBar() {
  return render(<AnnouncementBar />)
}

// ── setup / teardown ───────────────────────────────────────────────────────────

beforeEach(() => {
  mockConfig = null
  clearStorage()
  mockMatchMedia(false) // default: no reduced motion
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// ── tests ──────────────────────────────────────────────────────────────────────

describe('AnnouncementBar', () => {
  it('renders nothing when announcementEnabled is false', () => {
    mockConfig = {
      announcementEnabled: false,
      announcementType: 'single',
      announcementMessages: [{ text: 'Hello' }],
      announcementVersion: 1,
    } as Partial<StoreConfig>
    renderBar()
    expect(screen.queryByRole('region')).toBeNull()
  })

  it('renders nothing when config is null', () => {
    mockConfig = null
    renderBar()
    expect(screen.queryByRole('region')).toBeNull()
  })

  it('renders nothing when messages array is empty', () => {
    mockConfig = {
      announcementEnabled: true,
      announcementType: 'single',
      announcementMessages: [],
      announcementVersion: 1,
    } as Partial<StoreConfig>
    renderBar()
    expect(screen.queryByRole('region')).toBeNull()
  })

  describe('single type', () => {
    it('renders the message text', () => {
      mockConfig = {
        announcementEnabled: true,
        announcementType: 'single',
        announcementMessages: [{ text: 'Free shipping today!' }],
        announcementVersion: 1,
      } as Partial<StoreConfig>
      renderBar()
      expect(screen.getByText('Free shipping today!')).toBeTruthy()
    })

    it('wraps message in a link when msg.link is set (internal)', () => {
      mockConfig = {
        announcementEnabled: true,
        announcementType: 'single',
        announcementMessages: [{ text: 'Shop now', link: '/shop' }],
        announcementVersion: 1,
      } as Partial<StoreConfig>
      renderBar()
      const link = screen.getByRole('link')
      expect(link).toBeTruthy()
    })

    it('renders dismiss button with correct aria-label', () => {
      mockConfig = {
        announcementEnabled: true,
        announcementType: 'single',
        announcementMessages: [{ text: 'Sale' }],
        announcementVersion: 1,
      } as Partial<StoreConfig>
      renderBar()
      const btn = screen.getByRole('button', { name: 'Dismiss announcement' })
      expect(btn).toBeTruthy()
    })
  })

  describe('dismissal', () => {
    it('hides bar after dismiss click and persists version to localStorage', async () => {
      mockConfig = {
        announcementEnabled: true,
        announcementType: 'single',
        announcementMessages: [{ text: 'Sale on now' }],
        announcementVersion: 3,
      } as Partial<StoreConfig>
      renderBar()

      const btn = screen.getByRole('button', { name: 'Dismiss announcement' })
      await act(async () => {
        fireEvent.click(btn)
      })

      // Bar should vanish
      expect(screen.queryByText('Sale on now')).toBeNull()
      // Version persisted
      expect(localStorage.getItem(ANNOUNCEMENT_DISMISS_KEY)).toBe('3')
    })

    it('stays hidden when dismissed version matches current version', () => {
      setStoredVersion(5)
      mockConfig = {
        announcementEnabled: true,
        announcementType: 'single',
        announcementMessages: [{ text: 'Old announcement' }],
        announcementVersion: 5,
      } as Partial<StoreConfig>
      renderBar()
      expect(screen.queryByText('Old announcement')).toBeNull()
    })

    it('re-shows when announcement version is bumped beyond dismissed version', () => {
      setStoredVersion(5)
      mockConfig = {
        announcementEnabled: true,
        announcementType: 'single',
        announcementMessages: [{ text: 'New announcement' }],
        announcementVersion: 6,
      } as Partial<StoreConfig>
      renderBar()
      expect(screen.getByText('New announcement')).toBeTruthy()
    })
  })

  describe('scheduled type', () => {
    it('renders when current time is within the scheduled window', () => {
      const past = new Date(Date.now() - 60_000).toISOString()
      const future = new Date(Date.now() + 60_000).toISOString()
      mockConfig = {
        announcementEnabled: true,
        announcementType: 'scheduled',
        announcementMessages: [{ text: 'Flash sale' }],
        announcementStart: past,
        announcementEnd: future,
        announcementVersion: 1,
      } as Partial<StoreConfig>
      renderBar()
      expect(screen.getByText('Flash sale')).toBeTruthy()
    })

    it('renders nothing when before start time', () => {
      const future1 = new Date(Date.now() + 60_000).toISOString()
      const future2 = new Date(Date.now() + 120_000).toISOString()
      mockConfig = {
        announcementEnabled: true,
        announcementType: 'scheduled',
        announcementMessages: [{ text: 'Not yet' }],
        announcementStart: future1,
        announcementEnd: future2,
        announcementVersion: 1,
      } as Partial<StoreConfig>
      renderBar()
      expect(screen.queryByText('Not yet')).toBeNull()
    })

    it('renders nothing when after end time', () => {
      const past1 = new Date(Date.now() - 120_000).toISOString()
      const past2 = new Date(Date.now() - 60_000).toISOString()
      mockConfig = {
        announcementEnabled: true,
        announcementType: 'scheduled',
        announcementMessages: [{ text: 'Expired' }],
        announcementStart: past1,
        announcementEnd: past2,
        announcementVersion: 1,
      } as Partial<StoreConfig>
      renderBar()
      expect(screen.queryByText('Expired')).toBeNull()
    })
  })

  describe('rotating type', () => {
    it('renders the first message when only one message provided', () => {
      mockConfig = {
        announcementEnabled: true,
        announcementType: 'rotating',
        announcementMessages: [{ text: 'Only one' }],
        announcementVersion: 1,
      } as Partial<StoreConfig>
      renderBar()
      expect(screen.getByText('Only one')).toBeTruthy()
    })

    it('injects CSS animation styles for multiple messages', () => {
      mockConfig = {
        announcementEnabled: true,
        announcementType: 'rotating',
        announcementMessages: [{ text: 'Message A' }, { text: 'Message B' }, { text: 'Message C' }],
        announcementVersion: 1,
      } as Partial<StoreConfig>
      renderBar()
      // The style element should be rendered
      const styles = document.querySelectorAll('style')
      expect(styles.length).toBeGreaterThan(0)
      // At least ann-slide-0 keyframes present
      let found = false
      styles.forEach((s) => {
        if (s.innerHTML.includes('ann-slide-0')) found = true
      })
      expect(found).toBe(true)
    })

    describe('prefers-reduced-motion', () => {
      it('shows first message statically (no carousel) when reduced motion is set', () => {
        mockMatchMedia(true) // reduced motion ON
        mockConfig = {
          announcementEnabled: true,
          announcementType: 'rotating',
          announcementMessages: [{ text: 'First' }, { text: 'Second' }],
          announcementVersion: 1,
        } as Partial<StoreConfig>
        renderBar()
        // First message visible
        expect(screen.getByText('First')).toBeTruthy()
        // No CSS animation styles injected
        const styles = document.querySelectorAll('style')
        let hasCarousel = false
        styles.forEach((s) => {
          if (s.innerHTML.includes('ann-slide-0')) hasCarousel = true
        })
        expect(hasCarousel).toBe(false)
      })
    })

    it('each carousel slide inherits its own color when msg.color set', () => {
      mockConfig = {
        announcementEnabled: true,
        announcementType: 'rotating',
        announcementMessages: [
          { text: 'Slide A', color: '#112233' },
          { text: 'Slide B', color: '#aabbcc' },
        ],
        announcementVersion: 1,
      } as Partial<StoreConfig>
      renderBar()
      // Both messages rendered in the carousel
      expect(screen.getByText('Slide A')).toBeTruthy()
      expect(screen.getByText('Slide B')).toBeTruthy()
      // Each slide div should carry the per-message color as inline style
      const slideA = screen.getByText('Slide A').closest('[class*="ann-slide-0"]')
      expect(slideA).toBeTruthy()
    })

    it('carousel slides fall back to barBg/barFg when no per-slide color', () => {
      mockConfig = {
        announcementEnabled: true,
        announcementType: 'rotating',
        announcementMessages: [{ text: 'NoColor A' }, { text: 'NoColor B' }],
        announcementVersion: 1,
      } as Partial<StoreConfig>
      renderBar()
      expect(screen.getByText('NoColor A')).toBeTruthy()
      expect(screen.getByText('NoColor B')).toBeTruthy()
    })
  })

  describe('MessageContent link variants', () => {
    it('renders external link (plain <a> with target=_blank) when msg.link is absolute URL', () => {
      mockConfig = {
        announcementEnabled: true,
        announcementType: 'single',
        announcementMessages: [{ text: 'Visit us', link: 'https://example.com/promo' }],
        announcementVersion: 1,
      } as Partial<StoreConfig>
      renderBar()
      const anchor = screen.getByRole('link', { name: /Visit us/i })
      expect(anchor.getAttribute('target')).toBe('_blank')
      expect(anchor.getAttribute('rel')).toContain('noopener')
      expect(anchor.getAttribute('href')).toBe('https://example.com/promo')
    })

    it('renders plain text (no link element) when msg.link is absent', () => {
      mockConfig = {
        announcementEnabled: true,
        announcementType: 'single',
        announcementMessages: [{ text: 'No link here' }],
        announcementVersion: 1,
      } as Partial<StoreConfig>
      renderBar()
      expect(screen.getByText('No link here')).toBeTruthy()
      expect(screen.queryByRole('link')).toBeNull()
    })
  })

  describe('color theming', () => {
    it('applies valid hex color as background and computes high-contrast fg (dark bg → white)', () => {
      mockConfig = {
        announcementEnabled: true,
        announcementType: 'single',
        // #112233 has low luminance → fg should be #ffffff
        announcementMessages: [{ text: 'Dark bar', color: '#112233' }],
        announcementVersion: 1,
      } as Partial<StoreConfig>
      renderBar()
      const section = screen.getByRole('region')
      expect(section.getAttribute('style')).toContain('background-color: rgb(17, 34, 51)')
    })

    it('applies valid hex color as background and computes high-contrast fg (light bg → black)', () => {
      mockConfig = {
        announcementEnabled: true,
        announcementType: 'single',
        // #eeeeff has high luminance → fg should be #000000 (black)
        announcementMessages: [{ text: 'Light bar', color: '#eeeeff' }],
        announcementVersion: 1,
      } as Partial<StoreConfig>
      renderBar()
      const section = screen.getByRole('region')
      // jsdom normalizes hex to rgb(); check that the fg is black (high luminance → black)
      expect(section.getAttribute('style')).toContain('color: rgb(0, 0, 0)')
    })

    it('falls back to CSS var when color is absent', () => {
      mockConfig = {
        announcementEnabled: true,
        announcementType: 'single',
        announcementMessages: [{ text: 'Default color' }],
        announcementVersion: 1,
      } as Partial<StoreConfig>
      renderBar()
      const section = screen.getByRole('region')
      expect(section.getAttribute('style')).toContain('var(--primary)')
    })
  })

  describe('config null-coalescing', () => {
    it('renders when announcementType is undefined (falls back to single)', () => {
      mockConfig = {
        announcementEnabled: true,
        // announcementType deliberately missing
        announcementMessages: [{ text: 'Fallback type' }],
        announcementVersion: 1,
      } as Partial<StoreConfig>
      renderBar()
      expect(screen.getByText('Fallback type')).toBeTruthy()
    })

    it('renders when announcementVersion is undefined (falls back to 0)', () => {
      mockConfig = {
        announcementEnabled: true,
        announcementType: 'single',
        announcementMessages: [{ text: 'No version' }],
        // announcementVersion deliberately missing
      } as Partial<StoreConfig>
      renderBar()
      expect(screen.getByText('No version')).toBeTruthy()
    })
  })

  describe('scheduled type edge cases', () => {
    it('renders when only announcementEnd is set and now is before end', () => {
      const future = new Date(Date.now() + 60_000).toISOString()
      mockConfig = {
        announcementEnabled: true,
        announcementType: 'scheduled',
        announcementMessages: [{ text: 'Open ended start' }],
        announcementEnd: future,
        // no announcementStart → start=null branch
        announcementVersion: 1,
      } as Partial<StoreConfig>
      renderBar()
      expect(screen.getByText('Open ended start')).toBeTruthy()
    })

    it('renders when only announcementStart is set and now is after start', () => {
      const past = new Date(Date.now() - 60_000).toISOString()
      mockConfig = {
        announcementEnabled: true,
        announcementType: 'scheduled',
        announcementMessages: [{ text: 'Open ended end' }],
        announcementStart: past,
        // no announcementEnd → end=null branch
        announcementVersion: 1,
      } as Partial<StoreConfig>
      renderBar()
      expect(screen.getByText('Open ended end')).toBeTruthy()
    })
  })

  describe('localStorage edge cases', () => {
    it('ignores non-numeric stored version (treats as not dismissed)', () => {
      // Write non-numeric value manually — getDismissedVersion returns null
      localStorage.setItem(ANNOUNCEMENT_DISMISS_KEY, 'not-a-number')
      mockConfig = {
        announcementEnabled: true,
        announcementType: 'single',
        announcementMessages: [{ text: 'Should show' }],
        announcementVersion: 1,
      } as Partial<StoreConfig>
      renderBar()
      // Bar visible — non-numeric stored value treated as null → not dismissed
      expect(screen.getByText('Should show')).toBeTruthy()
    })

    it('persists dismissed version even when localStorage throws on write', async () => {
      const origSetItem = localStorage.setItem.bind(localStorage)
      vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
        throw new Error('QuotaExceededError')
      })
      mockConfig = {
        announcementEnabled: true,
        announcementType: 'single',
        announcementMessages: [{ text: 'Will dismiss' }],
        announcementVersion: 2,
      } as Partial<StoreConfig>
      renderBar()
      const btn = screen.getByRole('button', { name: 'Dismiss announcement' })
      // Should not throw even when setItem fails
      await act(async () => {
        fireEvent.click(btn)
      })
      // Bar is gone (state updated even if localStorage write failed)
      expect(screen.queryByText('Will dismiss')).toBeNull()
      vi.restoreAllMocks()
      void origSetItem
    })

    it('getDismissedVersion returns null when localStorage.getItem throws', () => {
      // Spy getItem to throw — the catch block returns null → bar shows (not dismissed)
      vi.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => {
        throw new Error('SecurityError')
      })
      mockConfig = {
        announcementEnabled: true,
        announcementType: 'single',
        announcementMessages: [{ text: 'Storage error' }],
        announcementVersion: 1,
      } as Partial<StoreConfig>
      renderBar()
      // catch → null → not dismissed → bar visible
      expect(screen.getByText('Storage error')).toBeTruthy()
      vi.restoreAllMocks()
    })

    it('renders when announcementMessages is null (falls back to empty array → hidden)', () => {
      // announcementMessages null → `config.announcementMessages ?? []` → [] → return null
      mockConfig = {
        announcementEnabled: true,
        announcementType: 'single',
        announcementMessages: null as unknown as [],
        announcementVersion: 1,
      } as Partial<StoreConfig>
      renderBar()
      expect(screen.queryByRole('region')).toBeNull()
    })
  })

  // ── [SECURITY] XSS render guard ───────────────────────────────────────────
  describe('XSS render guard (belt-and-suspenders link sanitisation)', () => {
    it('renders plain text (no link) when msg.link is javascript: URI', () => {
      mockConfig = {
        announcementEnabled: true,
        announcementType: 'single',
        // eslint-disable-next-line no-script-url
        announcementMessages: [{ text: 'Danger', link: 'javascript:alert(document.cookie)' }],
        announcementVersion: 1,
      } as Partial<StoreConfig>
      renderBar()
      // Text still shows
      expect(screen.getByText('Danger')).toBeTruthy()
      // No <a> or <Link> rendered
      expect(screen.queryByRole('link')).toBeNull()
    })

    it('renders plain text (no link) when msg.link is a data: URI', () => {
      mockConfig = {
        announcementEnabled: true,
        announcementType: 'single',
        announcementMessages: [{ text: 'Data', link: 'data:text/html,<script>alert(1)</script>' }],
        announcementVersion: 1,
      } as Partial<StoreConfig>
      renderBar()
      expect(screen.getByText('Data')).toBeTruthy()
      expect(screen.queryByRole('link')).toBeNull()
    })

    it('renders a link for a valid root-relative path (/shop)', () => {
      mockConfig = {
        announcementEnabled: true,
        announcementType: 'single',
        announcementMessages: [{ text: 'Shop now', link: '/shop' }],
        announcementVersion: 1,
      } as Partial<StoreConfig>
      renderBar()
      expect(screen.getByRole('link')).toBeTruthy()
    })

    it('renders an external link for a valid https URL', () => {
      mockConfig = {
        announcementEnabled: true,
        announcementType: 'single',
        announcementMessages: [{ text: 'Go', link: 'https://example.com/promo' }],
        announcementVersion: 1,
      } as Partial<StoreConfig>
      renderBar()
      const anchor = screen.getByRole('link')
      expect(anchor.getAttribute('href')).toBe('https://example.com/promo')
    })
  })

  // ── [BUG] Scheduled window with invalid date strings ──────────────────────
  describe('scheduled type — invalid date strings', () => {
    it('shows bar when announcementStart is not a parseable date (treated as open-ended)', () => {
      const future = new Date(Date.now() + 60_000).toISOString()
      mockConfig = {
        announcementEnabled: true,
        announcementType: 'scheduled',
        announcementMessages: [{ text: 'Bad start date' }],
        announcementStart: 'not-a-date',
        announcementEnd: future,
        announcementVersion: 1,
      } as Partial<StoreConfig>
      renderBar()
      // NaN start → treated as null (open-ended) → no early-return on start guard
      // End is valid and in the future → bar shows
      expect(screen.getByText('Bad start date')).toBeTruthy()
    })

    it('shows bar when announcementEnd is not a parseable date (treated as open-ended)', () => {
      const past = new Date(Date.now() - 60_000).toISOString()
      mockConfig = {
        announcementEnabled: true,
        announcementType: 'scheduled',
        announcementMessages: [{ text: 'Bad end date' }],
        announcementStart: past,
        announcementEnd: 'not-a-date',
        announcementVersion: 1,
      } as Partial<StoreConfig>
      renderBar()
      // NaN end → treated as null (open-ended) → no early-return on end guard
      // Start is valid and in the past → bar shows
      expect(screen.getByText('Bad end date')).toBeTruthy()
    })

    it('shows bar when both bounds are unparseable (both treated as null)', () => {
      mockConfig = {
        announcementEnabled: true,
        announcementType: 'scheduled',
        announcementMessages: [{ text: 'Both bad' }],
        announcementStart: 'bad-start',
        announcementEnd: 'bad-end',
        announcementVersion: 1,
      } as Partial<StoreConfig>
      renderBar()
      // Both null → no guard fires → degenerate scheduled acts like single → shows
      expect(screen.getByText('Both bad')).toBeTruthy()
    })
  })

  // ── [a11y] Section aria-label ─────────────────────────────────────────────
  describe('a11y — section landmark label', () => {
    it('section uses announcementBar label (not dismissAnnouncement) for single type', () => {
      mockConfig = {
        announcementEnabled: true,
        announcementType: 'single',
        announcementMessages: [{ text: 'a11y test' }],
        announcementVersion: 1,
      } as Partial<StoreConfig>
      renderBar()
      const section = screen.getByRole('region', { name: 'Announcement' })
      expect(section).toBeTruthy()
    })

    it('dismiss button retains its own dismissAnnouncement aria-label', () => {
      mockConfig = {
        announcementEnabled: true,
        announcementType: 'single',
        announcementMessages: [{ text: 'a11y button test' }],
        announcementVersion: 1,
      } as Partial<StoreConfig>
      renderBar()
      const btn = screen.getByRole('button', { name: 'Dismiss announcement' })
      expect(btn).toBeTruthy()
    })

    it('carousel section uses announcementBar label', () => {
      mockConfig = {
        announcementEnabled: true,
        announcementType: 'rotating',
        announcementMessages: [{ text: 'Msg A' }, { text: 'Msg B' }],
        announcementVersion: 1,
      } as Partial<StoreConfig>
      renderBar()
      const section = screen.getByRole('region', { name: 'Announcement' })
      expect(section).toBeTruthy()
    })
  })
})
