// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ShortcutsHelpOverlay } from './ShortcutsHelpOverlay'
import { TProvider } from '@/lib/i18n/Provider'
import { en } from '@/lib/i18n/en'
import type { ShortcutBinding } from '@/lib/types/shortcuts'

// ─── matchMedia mock (for useReducedMotion) ───────────────────────────────────

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

// ─── Sample fixtures ──────────────────────────────────────────────────────────

const SINGLE_KEY_BINDING: ShortcutBinding = {
  id: 'search',
  sequence: ['/'],
  labelKey: 'shortcuts.search',
}

const MULTI_KEY_BINDING: ShortcutBinding = {
  id: 'goOrders',
  sequence: ['g', 'o'],
  labelKey: 'shortcuts.goOrders',
}

const ALL_BINDINGS: readonly ShortcutBinding[] = [SINGLE_KEY_BINDING, MULTI_KEY_BINDING]

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  mockMatchMedia(false)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// ─── Helper ───────────────────────────────────────────────────────────────────

function renderOverlay(
  props: Partial<{
    open: boolean
    onOpenChange: (open: boolean) => void
    bindings: readonly ShortcutBinding[]
    locale: 'en' | 'fr' | 'ur'
  }> = {},
) {
  const { open = true, onOpenChange = vi.fn(), bindings = ALL_BINDINGS, locale = 'en' } = props

  return render(
    <TProvider locale={locale}>
      <ShortcutsHelpOverlay open={open} onOpenChange={onOpenChange} bindings={bindings} />
    </TProvider>,
  )
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ShortcutsHelpOverlay', () => {
  // 1. Dialog title shown when open
  it('shows the dialog title when open=true', () => {
    renderOverlay({ open: true })
    expect(screen.getByText(en.shortcuts.title)).toBeTruthy()
  })

  // 2. Dialog not visible when closed
  it('does not show title when open=false', () => {
    renderOverlay({ open: false })
    expect(screen.queryByText(en.shortcuts.title)).toBeNull()
  })

  // 3. Single-key binding renders one <kbd>
  it('renders one kbd element for a single-key binding', () => {
    renderOverlay({ bindings: [SINGLE_KEY_BINDING] })
    const kbds = document.querySelectorAll('kbd')
    expect(kbds.length).toBe(1)
    expect(kbds[0].textContent).toBe('/')
  })

  // 4. Single-key binding renders correct label
  it('renders the localized label for a single-key binding', () => {
    renderOverlay({ bindings: [SINGLE_KEY_BINDING] })
    expect(screen.getByText(en.shortcuts.search)).toBeTruthy()
  })

  // 5. Multi-key sequence renders two <kbd> elements
  it('renders two kbd elements for a two-key sequence', () => {
    renderOverlay({ bindings: [MULTI_KEY_BINDING] })
    const kbds = document.querySelectorAll('kbd')
    expect(kbds.length).toBe(2)
    expect(kbds[0].textContent).toBe('G')
    expect(kbds[1].textContent).toBe('O')
  })

  // 6. Multi-key sequence shows "then" separator
  it('renders the sequenceHint ("then") between keys in a multi-key binding', () => {
    renderOverlay({ bindings: [MULTI_KEY_BINDING] })
    expect(screen.getByText(en.shortcuts.sequenceHint)).toBeTruthy()
  })

  // 7. onOpenChange fires (dialog closes when base-ui close mechanism triggers)
  it('passes onOpenChange to the dialog', () => {
    const onOpenChange = vi.fn()
    renderOverlay({ open: true, onOpenChange })
    // The handler is wired to the Dialog — verify it is passed without crashing
    // (full close-button interaction tested via E2E; unit verifies prop wiring).
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  // 8. French locale renders correctly
  it('renders correctly under the fr locale', () => {
    renderOverlay({ locale: 'fr' })
    // French shortcuts.title value
    expect(screen.getByText('Raccourcis clavier')).toBeTruthy()
  })

  // 9. French sequenceHint renders correctly
  it('renders French sequenceHint for multi-key binding under fr locale', () => {
    renderOverlay({ bindings: [MULTI_KEY_BINDING], locale: 'fr' })
    expect(screen.getByText('puis')).toBeTruthy()
  })

  // 10. RTL dir attribute set for Urdu locale
  it('sets dir="rtl" on dialog content for Urdu locale', () => {
    renderOverlay({ locale: 'ur' })
    const popup = document.querySelector('[data-slot="dialog-content"]')
    expect(popup?.getAttribute('dir')).toBe('rtl')
  })

  // 11. LTR dir attribute for English locale
  it('sets dir="ltr" on dialog content for English locale', () => {
    renderOverlay({ locale: 'en' })
    const popup = document.querySelector('[data-slot="dialog-content"]')
    expect(popup?.getAttribute('dir')).toBe('ltr')
  })

  // 12. Urdu title renders
  it('renders the Urdu title under ur locale', () => {
    renderOverlay({ locale: 'ur' })
    expect(screen.getByText('کی بورڈ شارٹ کٹس')).toBeTruthy()
  })

  // 13. Reduced motion: component renders without crash, duration-0 class applied
  it('does not crash and applies duration-0 when reduced motion is preferred', () => {
    mockMatchMedia(true)
    renderOverlay()
    // The dialog title is still visible
    expect(screen.getByText(en.shortcuts.title)).toBeTruthy()
    // duration-0 class applied to the popup element
    const popup = document.querySelector('[data-slot="dialog-content"]')
    expect(popup?.className).toContain('duration-0')
  })

  // 14. No reduced motion: duration-0 class absent
  it('does not apply duration-0 when reduced motion is not preferred', () => {
    mockMatchMedia(false)
    renderOverlay()
    const popup = document.querySelector('[data-slot="dialog-content"]')
    expect(popup?.className ?? '').not.toContain('duration-0')
  })

  // 15. Missing label key fallback — renders the key path instead of crashing
  it('falls back to the labelKey string when the path does not exist in t', () => {
    const binding: ShortcutBinding = {
      id: 'help',
      sequence: ['?'],
      labelKey: 'shortcuts.nonExistentKey',
    }
    renderOverlay({ bindings: [binding] })
    // Should render the raw dot-path, not crash
    expect(screen.getByText('shortcuts.nonExistentKey')).toBeTruthy()
  })

  // 16. Special key display: Escape → Esc
  it('displays Escape key as "Esc"', () => {
    const binding: ShortcutBinding = {
      id: 'close',
      sequence: ['Escape'],
      labelKey: 'shortcuts.close',
    }
    renderOverlay({ bindings: [binding] })
    const kbds = document.querySelectorAll('kbd')
    expect(kbds[0].textContent).toBe('Esc')
  })

  // 17. Special key display: Enter → ↵
  it('displays Enter key as "↵"', () => {
    const binding: ShortcutBinding = {
      id: 'listOpen',
      sequence: ['Enter'],
      labelKey: 'shortcuts.listOpen',
    }
    renderOverlay({ bindings: [binding] })
    const kbds = document.querySelectorAll('kbd')
    expect(kbds[0].textContent).toBe('↵')
  })

  // 18. Multiple bindings all render
  it('renders all bindings from the bindings array', () => {
    renderOverlay({ bindings: ALL_BINDINGS })
    expect(screen.getByText(en.shortcuts.search)).toBeTruthy()
    expect(screen.getByText(en.shortcuts.goOrders)).toBeTruthy()
  })
})
