// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// Mock the API client. ApiError must be the real class so `instanceof` checks
// inside the hook behave correctly.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return {
    ...actual,
    apiGet: vi.fn(() => Promise.resolve({})),
  }
})

import { apiGet, ApiError } from '@/lib/api'
import { useApiResource, canReadCache, DATA_UPDATED_CHANNEL } from './useApiResource'

const mockApiGet = vi.mocked(apiGet)

// Unique path per call so the module-level _cache (which persists for the whole
// file) never bleeds between tests.
let _n = 0
const uniquePath = (prefix = '/api/products') => `${prefix}/${++_n}-${Date.now()}`

beforeEach(() => {
  mockApiGet.mockReset()
  mockApiGet.mockResolvedValue({})
})

afterEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('useApiResource', () => {
  it('stays loading with a null path and never fetches', () => {
    const { result } = renderHook(() => useApiResource<{ x: number }>(null))
    expect(result.current.loading).toBe(true)
    expect(result.current.data).toBeNull()
    expect(mockApiGet).not.toHaveBeenCalled()
  })

  it('fetches and exposes data on success', async () => {
    const path = uniquePath()
    mockApiGet.mockResolvedValueOnce({ name: 'ok' })
    const { result } = renderHook(() => useApiResource<{ name: string }>(path))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toEqual({ name: 'ok' })
    expect(result.current.error).toBeNull()
    expect(result.current.notFound).toBe(false)
    expect(mockApiGet).toHaveBeenCalledWith(path)
  })

  it('sets notFound on a 404 ApiError', async () => {
    const path = uniquePath()
    mockApiGet.mockRejectedValueOnce(new ApiError(404, 'missing'))
    const { result } = renderHook(() => useApiResource(path))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.notFound).toBe(true)
    expect(result.current.error).toBeNull()
    expect(result.current.data).toBeNull()
  })

  it('sets error on a non-404 ApiError', async () => {
    const path = uniquePath()
    mockApiGet.mockRejectedValueOnce(new ApiError(500, 'boom'))
    const { result } = renderHook(() => useApiResource(path))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('boom')
    expect(result.current.notFound).toBe(false)
  })

  it('sets error message on a plain Error', async () => {
    const path = uniquePath()
    mockApiGet.mockRejectedValueOnce(new Error('network down'))
    const { result } = renderHook(() => useApiResource(path))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('network down')
  })

  it('falls back to a generic message on a non-Error throw', async () => {
    const path = uniquePath()
    mockApiGet.mockRejectedValueOnce('weird')
    const { result } = renderHook(() => useApiResource(path))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('An error occurred')
  })

  it('caches read-only paths — a second hook on the same path starts non-loading', async () => {
    const path = uniquePath()
    mockApiGet.mockResolvedValue({ cached: true })

    const first = renderHook(() => useApiResource<{ cached: boolean }>(path))
    await waitFor(() => expect(first.result.current.loading).toBe(false))
    expect(first.result.current.data).toEqual({ cached: true })

    // Second mount of the same cached path: data primed from cache, not loading.
    const second = renderHook(() => useApiResource<{ cached: boolean }>(path))
    expect(second.result.current.data).toEqual({ cached: true })
    expect(second.result.current.loading).toBe(false)
  })

  it('never caches order paths', async () => {
    const path = `/api/orders/${++_n}`
    mockApiGet.mockResolvedValue({ order: 1 })

    const first = renderHook(() => useApiResource(path))
    await waitFor(() => expect(first.result.current.loading).toBe(false))

    // Second mount must re-enter loading because order paths are never cached.
    const second = renderHook(() => useApiResource(path))
    expect(second.result.current.loading).toBe(true)
  })

  it('refetches when the path changes', async () => {
    const a = uniquePath()
    const b = uniquePath()
    mockApiGet.mockImplementation((p: string) => Promise.resolve({ p }))

    const { result, rerender } = renderHook(({ path }) => useApiResource<{ p: string }>(path), {
      initialProps: { path: a },
    })
    await waitFor(() => expect(result.current.data).toEqual({ p: a }))

    rerender({ path: b })
    await waitFor(() => expect(result.current.data).toEqual({ p: b }))
    expect(mockApiGet).toHaveBeenCalledWith(a)
    expect(mockApiGet).toHaveBeenCalledWith(b)
  })

  it('refetchOnFocus triggers a silent refetch on visibility change', async () => {
    const path = uniquePath()
    mockApiGet.mockResolvedValue({ v: 1 })
    const { result } = renderHook(() => useApiResource(path, { refetchOnFocus: true }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    const callsBefore = mockApiGet.mock.calls.length

    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await waitFor(() => expect(mockApiGet.mock.calls.length).toBeGreaterThan(callsBefore))
  })

  it('refetchOnFocus ignores a hidden visibility change', async () => {
    const path = uniquePath()
    mockApiGet.mockResolvedValue({ v: 1 })
    const { result } = renderHook(() => useApiResource(path, { refetchOnFocus: true }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    const callsBefore = mockApiGet.mock.calls.length

    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'hidden',
      })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    // Give any erroneous refetch a tick to fire, then assert it did not.
    await new Promise((r) => setTimeout(r, 10))
    expect(mockApiGet.mock.calls.length).toBe(callsBefore)
  })

  it('refetchOnChannel refetches on a BroadcastChannel message', async () => {
    const path = uniquePath()
    mockApiGet.mockResolvedValue({ v: 1 })
    const { result } = renderHook(() => useApiResource(path, { refetchOnChannel: true }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    const callsBefore = mockApiGet.mock.calls.length

    act(() => {
      const ch = new BroadcastChannel(DATA_UPDATED_CHANNEL)
      ch.postMessage('invalidate')
      ch.close()
    })
    await waitFor(() => expect(mockApiGet.mock.calls.length).toBeGreaterThan(callsBefore))
  })

  it('refetchInterval refetches on the timer', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const path = uniquePath()
    mockApiGet.mockResolvedValue({ v: 1 })
    const { result } = renderHook(() => useApiResource(path, { refetchInterval: 1000 }))
    // Initial fetch resolves under fake timers; flush the microtask queue.
    await vi.waitFor(() => expect(result.current.loading).toBe(false))
    const callsBefore = mockApiGet.mock.calls.length

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(mockApiGet.mock.calls.length).toBeGreaterThan(callsBefore)
  })

  it('ignores a non-positive refetchInterval', async () => {
    const path = uniquePath()
    mockApiGet.mockResolvedValue({ v: 1 })
    const { result } = renderHook(() => useApiResource(path, { refetchInterval: 0 }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    // No interval scheduled — only the initial fetch.
    expect(mockApiGet).toHaveBeenCalledTimes(1)
  })

  it('ignores a negative refetchInterval (second branch of the guard)', async () => {
    // refetchInterval = -1: !opts?.refetchInterval is false (non-zero), but
    // opts.refetchInterval <= 0 is true → the second OR branch short-circuits.
    const path = uniquePath()
    mockApiGet.mockResolvedValue({ v: 1 })
    const { result } = renderHook(() => useApiResource(path, { refetchInterval: -1 }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    // No interval scheduled — only the initial fetch.
    expect(mockApiGet).toHaveBeenCalledTimes(1)
  })

  it('refetchOnChannel skips setup when BroadcastChannel is unavailable', async () => {
    // Simulate an environment where BroadcastChannel is not defined.
    const original = global.BroadcastChannel
    // @ts-expect-error — intentionally deleting to test the guard branch
    delete global.BroadcastChannel
    try {
      const path = uniquePath()
      mockApiGet.mockResolvedValue({ v: 1 })
      const { result } = renderHook(() => useApiResource(path, { refetchOnChannel: true }))
      await waitFor(() => expect(result.current.loading).toBe(false))
      // Only initial fetch — no channel listener set up.
      expect(mockApiGet).toHaveBeenCalledTimes(1)
    } finally {
      global.BroadcastChannel = original
    }
  })

  // CLS regression — SSR-seeded fallbackData must suppress the first-paint skeleton
  // while still triggering a background revalidation fetch.
  describe('fallbackData', () => {
    it('starts non-loading with fallback data — no skeleton on first paint', () => {
      const path = uniquePath()
      mockApiGet.mockResolvedValue({ products: [] })
      const fallback = { products: [{ id: 'p1' }] }
      const { result } = renderHook(() =>
        useApiResource<{ products: { id: string }[] }>(path, { fallbackData: fallback }),
      )
      // Must be immediately non-loading with the seeded data — no await needed.
      expect(result.current.loading).toBe(false)
      expect(result.current.data).toEqual(fallback)
      expect(result.current.error).toBeNull()
    })

    it('still fires a background revalidation fetch after seeding', async () => {
      const path = uniquePath()
      const fresh = { products: [{ id: 'fresh' }] }
      mockApiGet.mockResolvedValue(fresh)
      const fallback = { products: [{ id: 'stale' }] }
      const { result } = renderHook(() =>
        useApiResource<{ products: { id: string }[] }>(path, { fallbackData: fallback }),
      )
      // Immediately seeded, not loading.
      expect(result.current.loading).toBe(false)
      expect(result.current.data).toEqual(fallback)

      // Background fetch resolves and updates data silently.
      await waitFor(() => expect(result.current.data).toEqual(fresh))
      expect(mockApiGet).toHaveBeenCalledWith(path)
      // Loading never flipped to true (no skeleton flash during revalidation).
      expect(result.current.loading).toBe(false)
    })

    it('cache takes precedence over fallbackData', async () => {
      // Pre-warm cache by fetching once on a dedicated path.
      const path = uniquePath()
      const cached = { products: [{ id: 'cached' }] }
      mockApiGet.mockResolvedValue(cached)
      const first = renderHook(() => useApiResource<{ products: { id: string }[] }>(path))
      await waitFor(() => expect(first.result.current.data).toEqual(cached))

      // Second mount with a different fallbackData — cache value must win.
      const stale = { products: [{ id: 'stale-fallback' }] }
      const second = renderHook(() =>
        useApiResource<{ products: { id: string }[] }>(path, { fallbackData: stale }),
      )
      expect(second.result.current.data).toEqual(cached)
      expect(second.result.current.loading).toBe(false)
    })
  })

  // LCP regression — _cache must be ignored during SSR or its HTML diverges from
  // the client's fresh cache and blanks the grid (white flash → LCP reset).
  describe('canReadCache (SSR hydration guard)', () => {
    it('returns true for a cached read-only path while window is defined (client)', async () => {
      const path = uniquePath()
      mockApiGet.mockResolvedValue({ ok: true })
      const { result } = renderHook(() => useApiResource(path))
      await waitFor(() => expect(result.current.loading).toBe(false))
      expect(canReadCache(path)).toBe(true)
    })

    it('returns false when window is undefined even if the path is cached (SSR)', async () => {
      const path = uniquePath()
      mockApiGet.mockResolvedValue({ ok: true })
      const { result } = renderHook(() => useApiResource(path))
      await waitFor(() => expect(result.current.loading).toBe(false))
      expect(canReadCache(path)).toBe(true)

      vi.stubGlobal('window', undefined)
      try {
        expect(canReadCache(path)).toBe(false)
      } finally {
        vi.unstubAllGlobals()
      }
    })

    it('returns false for order paths (never cached) regardless of window', () => {
      expect(canReadCache(`/api/orders/${++_n}`)).toBe(false)
    })
  })
})
