// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'
import type { ShortcutHandlers } from '@/lib/types/shortcuts'
import { STORE_SHORTCUTS, ADMIN_SHORTCUTS } from '@/lib/constants/shortcuts'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fireKey(
  key: string,
  opts: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean; target: EventTarget }> = {},
) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    ctrlKey: opts.ctrlKey ?? false,
    metaKey: opts.metaKey ?? false,
    altKey: opts.altKey ?? false,
  })
  // Override target if needed (KeyboardEvent target is readonly).
  if (opts.target) {
    Object.defineProperty(event, 'target', { value: opts.target, configurable: true })
  }
  window.dispatchEvent(event)
}

function makeHandlers(overrides: Partial<ShortcutHandlers> = {}): ShortcutHandlers {
  return {
    search: undefined,
    cart: undefined,
    help: undefined,
    close: undefined,
    goOrders: undefined,
    goProducts: undefined,
    goCoupons: undefined,
    goAnalytics: undefined,
    create: undefined,
    listNext: undefined,
    listPrev: undefined,
    listOpen: undefined,
    ...overrides,
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useRealTimers()
})

describe('useKeyboardShortcuts — single key', () => {
  it('fires search handler on "/" key', () => {
    const search = vi.fn()
    renderHook(() =>
      useKeyboardShortcuts({
        bindings: STORE_SHORTCUTS,
        handlers: makeHandlers({ search }),
      }),
    )
    act(() => {
      fireKey('/')
    })
    expect(search).toHaveBeenCalledOnce()
  })

  it('does not fire when handler is undefined', () => {
    // No error should be thrown; handler map has undefined for all.
    const { unmount } = renderHook(() =>
      useKeyboardShortcuts({
        bindings: STORE_SHORTCUTS,
        handlers: makeHandlers(),
      }),
    )
    act(() => {
      fireKey('/')
    })
    unmount()
  })
})

describe('useKeyboardShortcuts — sequence', () => {
  it('fires goOrders after g then o sequence', () => {
    const goOrders = vi.fn()
    renderHook(() =>
      useKeyboardShortcuts({
        bindings: ADMIN_SHORTCUTS,
        handlers: makeHandlers({ goOrders }),
      }),
    )
    act(() => {
      fireKey('g')
      fireKey('o')
    })
    expect(goOrders).toHaveBeenCalledOnce()
  })
})

describe('useKeyboardShortcuts — timeout', () => {
  it('clears buffer after timeout so stale prefix does not fire handler', () => {
    vi.useFakeTimers()
    const goOrders = vi.fn()
    renderHook(() =>
      useKeyboardShortcuts({
        bindings: ADMIN_SHORTCUTS,
        handlers: makeHandlers({ goOrders }),
        timeoutMs: 1000,
      }),
    )
    // Press 'g' — partial match, timer starts.
    act(() => {
      fireKey('g')
    })
    // Advance past timeout — buffer clears.
    act(() => {
      vi.advanceTimersByTime(1001)
    })
    // 'o' alone has no binding in ADMIN_SHORTCUTS so goOrders should NOT fire.
    act(() => {
      fireKey('o')
    })
    expect(goOrders).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})

describe('useKeyboardShortcuts — input guard', () => {
  it('ignores keys typed inside a text input', () => {
    const search = vi.fn()
    renderHook(() =>
      useKeyboardShortcuts({
        bindings: STORE_SHORTCUTS,
        handlers: makeHandlers({ search }),
      }),
    )
    const input = document.createElement('input')
    input.type = 'text'
    document.body.appendChild(input)
    act(() => {
      fireKey('/', { target: input })
    })
    expect(search).not.toHaveBeenCalled()
    document.body.removeChild(input)
  })

  it('still fires close (Escape) even when an input is focused', () => {
    const close = vi.fn()
    renderHook(() =>
      useKeyboardShortcuts({
        bindings: STORE_SHORTCUTS,
        handlers: makeHandlers({ close }),
      }),
    )
    const input = document.createElement('input')
    input.type = 'text'
    document.body.appendChild(input)
    act(() => {
      fireKey('Escape', { target: input })
    })
    expect(close).toHaveBeenCalledOnce()
    document.body.removeChild(input)
  })
})

describe('useKeyboardShortcuts — modifier guard', () => {
  it('ignores a key when ctrl is held', () => {
    const search = vi.fn()
    renderHook(() =>
      useKeyboardShortcuts({
        bindings: STORE_SHORTCUTS,
        handlers: makeHandlers({ search }),
      }),
    )
    act(() => {
      fireKey('/', { ctrlKey: true })
    })
    expect(search).not.toHaveBeenCalled()
  })

  it('ignores a key when meta is held', () => {
    const search = vi.fn()
    renderHook(() =>
      useKeyboardShortcuts({
        bindings: STORE_SHORTCUTS,
        handlers: makeHandlers({ search }),
      }),
    )
    act(() => {
      fireKey('/', { metaKey: true })
    })
    expect(search).not.toHaveBeenCalled()
  })
})

describe('useKeyboardShortcuts — enabled flag', () => {
  it('does not fire any handler when enabled is false', () => {
    const search = vi.fn()
    const close = vi.fn()
    renderHook(() =>
      useKeyboardShortcuts({
        bindings: STORE_SHORTCUTS,
        handlers: makeHandlers({ search, close }),
        enabled: false,
      }),
    )
    act(() => {
      fireKey('/')
      fireKey('Escape')
    })
    expect(search).not.toHaveBeenCalled()
    expect(close).not.toHaveBeenCalled()
  })
})
