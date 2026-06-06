// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor, cleanup } from '@testing-library/react'
import { apiGet } from '@/lib/api'
import { DATA_UPDATED_CHANNEL } from '@/hooks/useApiResource'

vi.mock('@/lib/api', () => ({
  apiGet: vi.fn(),
}))

const mockConfig = { storeName: 'Test Store', currency: { code: 'PKR' } } as never

// Minimal BroadcastChannel mock that lets tests fire onmessage and assert close.
let lastChannel: { name: string; onmessage: ((e: unknown) => void) | null; close: ReturnType<typeof vi.fn> } | null = null
class MockBroadcastChannel {
  name: string
  onmessage: ((e: unknown) => void) | null = null
  close = vi.fn()
  postMessage = vi.fn()
  constructor(name: string) {
    this.name = name
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- test mock captures the constructed instance
    lastChannel = this
  }
}

beforeEach(() => {
  lastChannel = null
  vi.mocked(apiGet).mockResolvedValue(mockConfig)
  vi.stubGlobal('BroadcastChannel', MockBroadcastChannel as unknown as typeof BroadcastChannel)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

async function importHook() {
  return (await import('./useStoreConfig')).useStoreConfig
}

describe('useStoreConfig', () => {
  it('re-exports CONFIG_BROADCAST_CHANNEL aliased to DATA_UPDATED_CHANNEL', async () => {
    const { CONFIG_BROADCAST_CHANNEL } = await import('./useStoreConfig')
    expect(CONFIG_BROADCAST_CHANNEL).toBe(DATA_UPDATED_CHANNEL)
  })

  it('fetches config on mount and exposes it', async () => {
    const useStoreConfig = await importHook()
    const { result } = renderHook(() => useStoreConfig())
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.config).toBe(mockConfig)
    expect(result.current.error).toBeNull()
    expect(apiGet).toHaveBeenCalledWith('/api/config/store')
  })

  it('sets error message when fetch rejects with an Error', async () => {
    vi.mocked(apiGet).mockRejectedValueOnce(new Error('boom'))
    const useStoreConfig = await importHook()
    const { result } = renderHook(() => useStoreConfig())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('boom')
    expect(result.current.config).toBeNull()
  })

  it('uses fallback error message when rejection is not an Error', async () => {
    vi.mocked(apiGet).mockRejectedValueOnce('nope')
    const useStoreConfig = await importHook()
    const { result } = renderHook(() => useStoreConfig())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('Failed to load config')
  })

  it('refetches when the tab becomes visible', async () => {
    const useStoreConfig = await importHook()
    renderHook(() => useStoreConfig())
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(1))

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(2))
  })

  it('does not refetch when visibility is hidden', async () => {
    const useStoreConfig = await importHook()
    renderHook(() => useStoreConfig())
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(1))

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    // give microtasks a tick; count should remain 1
    await Promise.resolve()
    expect(apiGet).toHaveBeenCalledTimes(1)
  })

  it('refetches on BroadcastChannel message and closes channel on unmount', async () => {
    const useStoreConfig = await importHook()
    const { unmount } = renderHook(() => useStoreConfig())
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(1))
    expect(lastChannel).not.toBeNull()
    expect(lastChannel!.name).toBe(DATA_UPDATED_CHANNEL)

    act(() => {
      lastChannel!.onmessage?.({})
    })
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(2))

    unmount()
    expect(lastChannel!.close).toHaveBeenCalled()
  })

  it('skips BroadcastChannel wiring when the API is unavailable', async () => {
    vi.stubGlobal('BroadcastChannel', undefined)
    const useStoreConfig = await importHook()
    const { result } = renderHook(() => useStoreConfig())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(lastChannel).toBeNull()
  })
})
