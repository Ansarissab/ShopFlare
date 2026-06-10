// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor, cleanup } from '@testing-library/react'
import { apiGet, apiPost } from '@/lib/api'
import { usePushSubscription } from './usePushSubscription'

vi.mock('@/lib/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(() => Promise.resolve({})),
}))

// ---- Browser API doubles -----------------------------------------------------
let getSubscriptionResult: unknown = null
let subscribeResult: { endpoint: string; toJSON: () => unknown } | null = null
let readyReg: unknown

function makeReg() {
  return {
    pushManager: {
      getSubscription: vi.fn(() => Promise.resolve(getSubscriptionResult)),
      subscribe: vi.fn(() => Promise.resolve(subscribeResult)),
    },
  }
}

function installSupportedEnv() {
  // Notification
  const Notification = vi.fn() as unknown as typeof globalThis.Notification & {
    permission: NotificationPermission
    requestPermission: ReturnType<typeof vi.fn>
  }
  Notification.permission = 'default'
  Notification.requestPermission = vi.fn(() => Promise.resolve('granted' as NotificationPermission))
  vi.stubGlobal('Notification', Notification)

  // PushManager presence check
  vi.stubGlobal('PushManager', function PushManager() {})

  readyReg = makeReg()
  Object.defineProperty(navigator, 'serviceWorker', {
    value: { ready: Promise.resolve(readyReg) },
    configurable: true,
  })
  return Notification
}

const validSub = {
  endpoint: 'https://push.example/abc',
  toJSON: () => ({ keys: { auth: 'AUTH', p256dh: 'P256' } }),
}

beforeEach(() => {
  getSubscriptionResult = null
  subscribeResult = validSub
  vi.mocked(apiGet).mockResolvedValue({ vapidPublicKey: 'aGVsbG8' } as never)
  vi.mocked(apiPost).mockResolvedValue({} as never)
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('usePushSubscription — capability detection', () => {
  it('reports unsupported when push APIs are missing', async () => {
    vi.stubGlobal('Notification', undefined)
    const { result } = renderHook(() => usePushSubscription())
    await waitFor(() => expect(result.current.supported).toBe(false))
    expect(result.current.permission).toBe('default')
  })

  it('reports supported and reads current permission', async () => {
    const N = installSupportedEnv()
    N.permission = 'granted'
    const { result } = renderHook(() => usePushSubscription())
    await waitFor(() => expect(result.current.supported).toBe(true))
    expect(result.current.permission).toBe('granted')
  })

  it('marks enabled from localStorage flag (per-endpoint key)', async () => {
    installSupportedEnv()
    localStorage.setItem('pwa-push-/api/custom/subscribe', '1')
    const { result } = renderHook(() => usePushSubscription({ endpoint: '/api/custom/subscribe' }))
    await waitFor(() => expect(result.current.enabled).toBe(true))
  })

  it('falls back to PushManager.getSubscription when no storage flag', async () => {
    installSupportedEnv()
    getSubscriptionResult = { endpoint: 'x' }
    const { result } = renderHook(() => usePushSubscription())
    await waitFor(() => expect(result.current.enabled).toBe(true))
  })

  it('stays disabled when getSubscription returns null', async () => {
    installSupportedEnv()
    getSubscriptionResult = null
    const { result } = renderHook(() => usePushSubscription())
    await waitFor(() => expect(result.current.supported).toBe(true))
    expect(result.current.enabled).toBe(false)
  })

  it('falls back to PushManager when localStorage.getItem throws (catch → false)', async () => {
    installSupportedEnv()
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked')
    })
    getSubscriptionResult = { endpoint: 'x' }
    const { result } = renderHook(() => usePushSubscription())
    // wasRegistered swallowed the throw → false → PushManager path → enabled
    await waitFor(() => expect(result.current.enabled).toBe(true))
    spy.mockRestore()
  })

  it('swallows a serviceWorker.ready rejection in the capability effect', async () => {
    installSupportedEnv()
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { ready: Promise.reject(new Error('sw failed')) },
      configurable: true,
    })
    const { result } = renderHook(() => usePushSubscription())
    await waitFor(() => expect(result.current.supported).toBe(true))
    // ready rejected → .catch no-op → stays disabled, no throw
    expect(result.current.enabled).toBe(false)
  })
})

describe('usePushSubscription — enable()', () => {
  it('returns false and no-ops when unsupported', async () => {
    vi.stubGlobal('Notification', undefined)
    const { result } = renderHook(() => usePushSubscription())
    await waitFor(() => expect(result.current.supported).toBe(false))
    let ret: boolean | undefined
    await act(async () => {
      ret = await result.current.enable()
    })
    expect(ret).toBe(false)
    expect(apiPost).not.toHaveBeenCalled()
  })

  it('happy path: grants, subscribes, POSTs and persists', async () => {
    const N = installSupportedEnv()
    N.requestPermission = vi.fn(() => Promise.resolve('granted' as NotificationPermission))
    const { result } = renderHook(() =>
      usePushSubscription({ extraPayload: { kind: 'order', orderNumber: 'A1' } }),
    )
    await waitFor(() => expect(result.current.supported).toBe(true))

    let ret: boolean | undefined
    await act(async () => {
      ret = await result.current.enable()
    })

    expect(ret).toBe(true)
    expect(result.current.enabled).toBe(true)
    expect(result.current.permission).toBe('granted')
    expect(apiPost).toHaveBeenCalledWith('/api/admin/push/subscribe', {
      endpoint: 'https://push.example/abc',
      auth: 'AUTH',
      p256dh: 'P256',
      kind: 'order',
      orderNumber: 'A1',
    })
    // Default endpoint stores under the 'admin' storage-key suffix.
    expect(localStorage.getItem('pwa-push-admin')).toBe('1')
  })

  it('uses a custom endpoint when provided', async () => {
    installSupportedEnv()
    const { result } = renderHook(() => usePushSubscription({ endpoint: '/api/cust/sub' }))
    await waitFor(() => expect(result.current.supported).toBe(true))
    await act(async () => {
      await result.current.enable()
    })
    expect(apiPost).toHaveBeenCalledWith('/api/cust/sub', expect.any(Object))
    expect(localStorage.getItem('pwa-push-/api/cust/sub')).toBe('1')
  })

  it('returns false when permission is not granted', async () => {
    const N = installSupportedEnv()
    N.requestPermission = vi.fn(() => Promise.resolve('denied' as NotificationPermission))
    const { result } = renderHook(() => usePushSubscription())
    await waitFor(() => expect(result.current.supported).toBe(true))
    let ret: boolean | undefined
    await act(async () => {
      ret = await result.current.enable()
    })
    expect(ret).toBe(false)
    expect(result.current.permission).toBe('denied')
    expect(apiPost).not.toHaveBeenCalled()
  })

  it('returns false when no VAPID key is returned', async () => {
    installSupportedEnv()
    vi.mocked(apiGet).mockResolvedValueOnce({} as never)
    const { result } = renderHook(() => usePushSubscription())
    await waitFor(() => expect(result.current.supported).toBe(true))
    let ret: boolean | undefined
    await act(async () => {
      ret = await result.current.enable()
    })
    expect(ret).toBe(false)
    expect(apiPost).not.toHaveBeenCalled()
  })

  it('returns false when subscription is missing keys', async () => {
    installSupportedEnv()
    subscribeResult = { endpoint: 'x', toJSON: () => ({ keys: {} }) }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { result } = renderHook(() => usePushSubscription())
    await waitFor(() => expect(result.current.supported).toBe(true))
    let ret: boolean | undefined
    await act(async () => {
      ret = await result.current.enable()
    })
    expect(ret).toBe(false)
    expect(warn).toHaveBeenCalled()
    expect(apiPost).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('catches thrown errors and returns false', async () => {
    installSupportedEnv()
    vi.mocked(apiGet).mockRejectedValueOnce(new Error('network'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { result } = renderHook(() => usePushSubscription())
    await waitFor(() => expect(result.current.supported).toBe(true))
    let ret: boolean | undefined
    await act(async () => {
      ret = await result.current.enable()
    })
    expect(ret).toBe(false)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('still returns true when localStorage.setItem throws (persist catch)', async () => {
    installSupportedEnv()
    const setSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    const { result } = renderHook(() => usePushSubscription())
    await waitFor(() => expect(result.current.supported).toBe(true))
    let ret: boolean | undefined
    await act(async () => {
      ret = await result.current.enable()
    })
    // setItem threw but the catch {} swallows it → enable still succeeds
    expect(ret).toBe(true)
    expect(result.current.enabled).toBe(true)
    expect(apiPost).toHaveBeenCalled()
    setSpy.mockRestore()
  })

  it('toggles loading true during enable() then back to false', async () => {
    installSupportedEnv()
    let release: (v: unknown) => void = () => {}
    vi.mocked(apiGet).mockImplementationOnce(
      () =>
        new Promise((r) => {
          release = r
        }) as never,
    )
    const { result } = renderHook(() => usePushSubscription())
    await waitFor(() => expect(result.current.supported).toBe(true))

    let done!: Promise<boolean>
    await act(async () => {
      done = result.current.enable()
      await Promise.resolve()
    })
    // setLoading(true) committed before the awaited apiGet resolves
    expect(result.current.loading).toBe(true)

    await act(async () => {
      release({ vapidPublicKey: 'aGVsbG8' })
      await done
    })
    // finally{} resets loading back to false
    expect(result.current.loading).toBe(false)
  })
})
