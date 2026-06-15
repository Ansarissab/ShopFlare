// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import { StoreShortcuts } from './StoreShortcuts'

// ─── Mock provider hooks ──────────────────────────────────────────────────────
//
// We mock the three provider hooks so the component can render without their
// full provider trees.  Each mock returns a stable object whose functions are
// spies we can inspect in assertions.

const mockOpenSearch = vi.fn()
const mockCloseSearch = vi.fn()
let mockSearchOpen = false

vi.mock('@/components/store/search/SearchProvider', () => ({
  useSearchOverlay: () => ({
    get open() {
      return mockSearchOpen
    },
    openSearch: mockOpenSearch,
    closeSearch: mockCloseSearch,
  }),
}))

const mockOpenCart = vi.fn()
const mockCloseCart = vi.fn()
let mockCartOpen = false

vi.mock('@/hooks/useCart', () => ({
  useCart: (
    selector?: (s: { isOpen: boolean; openCart: () => void; closeCart: () => void }) => unknown,
  ) => {
    const state = {
      isOpen: mockCartOpen,
      openCart: mockOpenCart,
      closeCart: mockCloseCart,
    }
    return selector ? selector(state) : state
  },
}))

// Mock ShortcutsHelpOverlay so we can track open state without needing Dialog
// infra (portals, aria, etc.) in jsdom.
const mockSetOpen = vi.fn()

vi.mock('@/components/shared/ShortcutsHelpOverlay', () => {
  let _open = false
  const useShortcutsHelp = () => ({
    get open() {
      return _open
    },
    setOpen: (v: boolean) => {
      _open = v
      mockSetOpen(v)
    },
    openHelp: () => {
      _open = true
      mockSetOpen(true)
    },
    closeHelp: () => {
      _open = false
      mockSetOpen(false)
    },
  })

  const ShortcutsHelpOverlay = ({ open }: { open: boolean }) => (
    <div data-testid="help-overlay" data-open={String(open)} />
  )

  return { useShortcutsHelp, ShortcutsHelpOverlay }
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fireKey(
  key: string,
  opts: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean }> = {},
) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    ctrlKey: opts.ctrlKey ?? false,
    metaKey: opts.metaKey ?? false,
    altKey: opts.altKey ?? false,
  })
  window.dispatchEvent(event)
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  mockSearchOpen = false
  mockCartOpen = false
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('StoreShortcuts', () => {
  it('pressing / calls openSearch', () => {
    render(<StoreShortcuts />)
    act(() => {
      fireKey('/')
    })
    expect(mockOpenSearch).toHaveBeenCalledOnce()
  })

  it('pressing c calls openCart', () => {
    render(<StoreShortcuts />)
    act(() => {
      fireKey('c')
    })
    expect(mockOpenCart).toHaveBeenCalledOnce()
  })

  it('pressing ? opens the help overlay (setOpen called with true)', () => {
    render(<StoreShortcuts />)
    act(() => {
      fireKey('?')
    })
    expect(mockSetOpen).toHaveBeenCalledWith(true)
  })

  it('pressing Escape while help is open closes the help overlay', async () => {
    render(<StoreShortcuts />)

    // Open help first
    act(() => {
      fireKey('?')
    })
    expect(mockSetOpen).toHaveBeenCalledWith(true)

    // Now Escape should close help, not search/cart
    act(() => {
      fireKey('Escape')
    })
    expect(mockSetOpen).toHaveBeenLastCalledWith(false)
    expect(mockCloseSearch).not.toHaveBeenCalled()
    expect(mockCloseCart).not.toHaveBeenCalled()
  })

  it('pressing Escape while search is open closes search (help already closed)', () => {
    mockSearchOpen = true
    render(<StoreShortcuts />)
    act(() => {
      fireKey('Escape')
    })
    expect(mockCloseSearch).toHaveBeenCalledOnce()
    expect(mockCloseCart).not.toHaveBeenCalled()
  })

  it('pressing Escape while cart is open closes cart (help+search closed)', () => {
    mockCartOpen = true
    render(<StoreShortcuts />)
    act(() => {
      fireKey('Escape')
    })
    expect(mockCloseCart).toHaveBeenCalledOnce()
    expect(mockCloseSearch).not.toHaveBeenCalled()
  })
})
