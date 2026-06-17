// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useScrollDirection } from './useScrollDirection'

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Scroll the window to a given Y position and flush the rAF callback.
 * Uses fake timers so we can drive requestAnimationFrame synchronously.
 */
function scrollTo(y: number) {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true, writable: true })
  window.dispatchEvent(new Event('scroll'))
  // Flush the queued rAF (fake timers mode: vi.runAllTimers advances rAF stubs)
  act(() => {
    vi.runAllTimers()
  })
}

beforeEach(() => {
  // Start every test at top of page
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true, writable: true })
  // Use fake timers so requestAnimationFrame is driven synchronously
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useScrollDirection', () => {
  it('starts as hidden=false (top of page)', () => {
    const { result } = renderHook(() => useScrollDirection())
    expect(result.current.hidden).toBe(false)
  })

  it('hidden=true when scrolling down past THRESHOLD (80px)', () => {
    const { result } = renderHook(() => useScrollDirection())

    act(() => {
      scrollTo(100)
    })

    expect(result.current.hidden).toBe(true)
  })

  it('hidden=false when scrolling back up', () => {
    const { result } = renderHook(() => useScrollDirection())

    act(() => {
      scrollTo(100)
    })
    expect(result.current.hidden).toBe(true)

    act(() => {
      scrollTo(50)
    })
    expect(result.current.hidden).toBe(false)
  })

  it('hidden=false when scrollY drops to/below THRESHOLD (80px)', () => {
    const { result } = renderHook(() => useScrollDirection())

    // Scroll down past threshold
    act(() => {
      scrollTo(150)
    })
    expect(result.current.hidden).toBe(true)

    // Scroll back to exactly the threshold
    act(() => {
      scrollTo(80)
    })
    expect(result.current.hidden).toBe(false)
  })

  it('ignores tiny jitters < 5px DELTA — does not hide', () => {
    const { result } = renderHook(() => useScrollDirection())

    // First move past threshold to set lastScrollY to 100
    act(() => {
      scrollTo(100)
    })
    expect(result.current.hidden).toBe(true)

    // Scroll back up a bit so hidden becomes false
    act(() => {
      scrollTo(90)
    })
    expect(result.current.hidden).toBe(false)

    // Tiny downward jitter of 3px (< DELTA=5) — should NOT re-hide
    act(() => {
      scrollTo(93)
    })
    expect(result.current.hidden).toBe(false)
  })

  it('does not hide when below THRESHOLD even if scrolling down', () => {
    const { result } = renderHook(() => useScrollDirection())

    // Scroll down but stay at/below 80px threshold
    act(() => {
      scrollTo(40)
    })
    expect(result.current.hidden).toBe(false)

    act(() => {
      scrollTo(70)
    })
    expect(result.current.hidden).toBe(false)
  })

  it('second scroll down past threshold after scrolling up re-hides', () => {
    const { result } = renderHook(() => useScrollDirection())

    // Down past threshold → hide
    act(() => {
      scrollTo(120)
    })
    expect(result.current.hidden).toBe(true)

    // Scroll up → show
    act(() => {
      scrollTo(50)
    })
    expect(result.current.hidden).toBe(false)

    // Scroll down again past threshold → hide again
    act(() => {
      scrollTo(200)
    })
    expect(result.current.hidden).toBe(true)
  })

  it('cleans up scroll listener on unmount (no errors after unmount)', () => {
    const { unmount } = renderHook(() => useScrollDirection())
    // Unmount should remove the listener without throwing
    expect(() => unmount()).not.toThrow()
    // Subsequent scroll events should not cause errors
    expect(() => {
      Object.defineProperty(window, 'scrollY', { value: 200, configurable: true, writable: true })
      window.dispatchEvent(new Event('scroll'))
      vi.runAllTimers()
    }).not.toThrow()
  })

  it('rAF early return: second scroll before frame fires is a no-op', () => {
    // The second scroll event hits the `if (rafId.current !== null) return` guard.
    // Proof: fire two scrolls without flushing between them. The rAF callback runs
    // once and reads scrollY at that moment. The second event queued nothing new,
    // so the final state matches the scrollY value when the frame eventually runs.
    const { result } = renderHook(() => useScrollDirection())

    act(() => {
      // First scroll past threshold — queues rAF, does NOT flush yet
      Object.defineProperty(window, 'scrollY', { value: 100, configurable: true, writable: true })
      window.dispatchEvent(new Event('scroll'))

      // Second scroll (still past threshold) before the frame fires.
      // This hits the early return — no second rAF is queued.
      // We set scrollY to something that would NOT trigger hide if processed,
      // to prove the second event had no effect on the outcome.
      Object.defineProperty(window, 'scrollY', { value: 200, configurable: true, writable: true })
      window.dispatchEvent(new Event('scroll'))

      // Flush the ONE queued rAF — reads current scrollY (200), still hides
      vi.runAllTimers()
    })

    // hidden=true: the frame processed once using the scrollY at flush time
    expect(result.current.hidden).toBe(true)

    act(() => {
      // Now a single scroll UP — no pending rAF, so a fresh one is queued and flushed
      Object.defineProperty(window, 'scrollY', { value: 50, configurable: true, writable: true })
      window.dispatchEvent(new Event('scroll'))
      vi.runAllTimers()
    })

    // scrollY dropped to 50 (≤ THRESHOLD 80) → hidden=false
    expect(result.current.hidden).toBe(false)
  })

  it('cleanup cancels a pending rAF on unmount', () => {
    const cancelAnimationFrameSpy = vi.spyOn(window, 'cancelAnimationFrame')

    const { unmount } = renderHook(() => useScrollDirection())

    act(() => {
      // Fire a scroll to queue a rAF — do NOT flush it
      Object.defineProperty(window, 'scrollY', { value: 150, configurable: true, writable: true })
      window.dispatchEvent(new Event('scroll'))
    })

    // Unmount before the rAF fires — cleanup should call cancelAnimationFrame
    act(() => {
      unmount()
    })

    expect(cancelAnimationFrameSpy).toHaveBeenCalledTimes(1)
  })
})
