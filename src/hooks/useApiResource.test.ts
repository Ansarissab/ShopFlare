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
import { useApiResource, DATA_UPDATED_CHANNEL } from './useApiResource'

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
})
