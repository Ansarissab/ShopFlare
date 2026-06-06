// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
import { useDisplayMode, useIsStandalone } from './useDisplayMode'

// matchMedia mock that lets each test decide which query "matches" and exposes
// the registered change listeners so we can drive subscribe() callbacks.
type Listener = (e?: unknown) => void
let matchingQuery: string | null = null
const listeners = new Map<string, Set<Listener>>()

function makeMatchMedia() {
  return vi.fn((query: string) => {
    if (!listeners.has(query)) listeners.set(query, new Set())
    return {
      matches: matchingQuery === query,
      media: query,
      addEventListener: (_: string, cb: Listener) => listeners.get(query)!.add(cb),
      removeEventListener: (_: string, cb: Listener) => listeners.get(query)!.delete(cb),
    }
  })
}

beforeEach(() => {
  matchingQuery = null
  listeners.clear()
  vi.stubGlobal('matchMedia', makeMatchMedia())
  // navigator.standalone defaults off
  Object.defineProperty(navigator, 'standalone', { value: false, configurable: true })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('useDisplayMode', () => {
  it('returns "browser" when nothing matches', () => {
    const { result } = renderHook(() => useDisplayMode())
    expect(result.current).toBe('browser')
  })

  it('returns "standalone" when navigator.standalone is true (iOS Safari)', () => {
    Object.defineProperty(navigator, 'standalone', { value: true, configurable: true })
    const { result } = renderHook(() => useDisplayMode())
    expect(result.current).toBe('standalone')
  })

  it('returns "fullscreen" when the fullscreen media query matches', () => {
    matchingQuery = '(display-mode: fullscreen)'
    const { result } = renderHook(() => useDisplayMode())
    expect(result.current).toBe('fullscreen')
  })

  it('returns "standalone" when the standalone media query matches', () => {
    matchingQuery = '(display-mode: standalone)'
    const { result } = renderHook(() => useDisplayMode())
    expect(result.current).toBe('standalone')
  })

  it('returns "minimal-ui" when the minimal-ui media query matches', () => {
    matchingQuery = '(display-mode: minimal-ui)'
    const { result } = renderHook(() => useDisplayMode())
    expect(result.current).toBe('minimal-ui')
  })

  it('subscribes to change events and re-reads the snapshot', () => {
    const { result } = renderHook(() => useDisplayMode())
    expect(result.current).toBe('browser')

    // Flip the match then fire a registered change listener.
    act(() => {
      matchingQuery = '(display-mode: standalone)'
      listeners.get('(display-mode: standalone)')?.forEach((cb) => cb())
    })
    expect(result.current).toBe('standalone')
  })

  it('removes change listeners on unmount', () => {
    const { unmount } = renderHook(() => useDisplayMode())
    const total = [...listeners.values()].reduce((n, s) => n + s.size, 0)
    expect(total).toBeGreaterThan(0)
    unmount()
    const after = [...listeners.values()].reduce((n, s) => n + s.size, 0)
    expect(after).toBe(0)
  })
})

describe('useIsStandalone', () => {
  it('is true when display mode is standalone', () => {
    matchingQuery = '(display-mode: standalone)'
    const { result } = renderHook(() => useIsStandalone())
    expect(result.current).toBe(true)
  })

  it('is false when display mode is browser', () => {
    const { result } = renderHook(() => useIsStandalone())
    expect(result.current).toBe(false)
  })
})
