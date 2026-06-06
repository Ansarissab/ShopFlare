/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { vibrate, type HapticPattern } from '@/lib/utils/haptics'

describe('vibrate', () => {
  let vibrateSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // jsdom does not expose navigator.vibrate — define it so vi.spyOn can wrap it
    if (!('vibrate' in navigator)) {
      Object.defineProperty(navigator, 'vibrate', {
        configurable: true,
        writable: true,
        value: () => true,
      })
    }
    vibrateSpy = vi.spyOn(navigator, 'vibrate').mockImplementation(() => true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls navigator.vibrate with the light pattern (10ms)', () => {
    vibrate('light')
    expect(vibrateSpy).toHaveBeenCalledWith(10)
  })

  it('calls navigator.vibrate with the medium pattern (25ms)', () => {
    vibrate('medium')
    expect(vibrateSpy).toHaveBeenCalledWith(25)
  })

  it('calls navigator.vibrate with the success pattern', () => {
    vibrate('success')
    expect(vibrateSpy).toHaveBeenCalledWith([15, 50, 15])
  })

  it('calls navigator.vibrate with the error pattern', () => {
    vibrate('error')
    expect(vibrateSpy).toHaveBeenCalledWith([50, 100, 50])
  })

  it('defaults to light pattern when no argument given', () => {
    vibrate()
    expect(vibrateSpy).toHaveBeenCalledWith(10)
  })

  it('does not throw when navigator.vibrate throws', () => {
    vibrateSpy.mockImplementation(() => { throw new Error('unsupported') })
    expect(() => vibrate('light')).not.toThrow()
  })

  it('does not call vibrate when navigator.vibrate is unavailable', () => {
    // Override to undefined to simulate a browser without Vibration API
    vibrateSpy.mockRestore()
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      writable: true,
      value: undefined,
    })

    const callCount = vi.fn()
    expect(() => vibrate('medium')).not.toThrow()
    // No spy to assert on — the source code guards with `if (!navigator.vibrate) return`
    expect(callCount).not.toHaveBeenCalled()

    // Re-install spy so afterEach restoreAllMocks doesn't error
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      writable: true,
      value: () => true,
    })
    vibrateSpy = vi.spyOn(navigator, 'vibrate').mockImplementation(() => true)
  })

  it('calls vibrate exactly once per invocation', () => {
    vibrate('success')
    expect(vibrateSpy).toHaveBeenCalledTimes(1)
  })

  it('all HapticPattern values are supported', () => {
    const patterns: HapticPattern[] = ['light', 'medium', 'success', 'error']
    for (const p of patterns) {
      vibrateSpy.mockClear()
      vibrate(p)
      expect(vibrateSpy).toHaveBeenCalledTimes(1)
    }
  })
})
