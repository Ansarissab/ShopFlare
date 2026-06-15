// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useReducedMotion } from './useReducedMotion'

type ChangeHandler = (e: MediaQueryListEvent) => void

function makeMql(matches: boolean) {
  const listeners = new Set<ChangeHandler>()
  const mql = {
    matches,
    addEventListener: vi.fn((_: string, fn: ChangeHandler) => listeners.add(fn)),
    removeEventListener: vi.fn((_: string, fn: ChangeHandler) => listeners.delete(fn)),
    dispatchChange(nextMatches: boolean) {
      listeners.forEach((fn) => fn({ matches: nextMatches } as MediaQueryListEvent))
    },
  }
  return mql
}

describe('useReducedMotion', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns false when prefers-reduced-motion does not match', () => {
    const mql = makeMql(false)
    vi.spyOn(window, 'matchMedia').mockReturnValue(mql as unknown as MediaQueryList)

    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(false)
  })

  it('returns true when prefers-reduced-motion matches', () => {
    const mql = makeMql(true)
    vi.spyOn(window, 'matchMedia').mockReturnValue(mql as unknown as MediaQueryList)

    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(true)
  })

  it('updates when the media query fires a change event', () => {
    const mql = makeMql(false)
    vi.spyOn(window, 'matchMedia').mockReturnValue(mql as unknown as MediaQueryList)

    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(false)

    act(() => {
      mql.dispatchChange(true)
    })
    expect(result.current).toBe(true)

    act(() => {
      mql.dispatchChange(false)
    })
    expect(result.current).toBe(false)
  })

  it('removes the event listener on unmount', () => {
    const mql = makeMql(false)
    vi.spyOn(window, 'matchMedia').mockReturnValue(mql as unknown as MediaQueryList)

    const { unmount } = renderHook(() => useReducedMotion())
    unmount()
    expect(mql.removeEventListener).toHaveBeenCalled()
  })
})
